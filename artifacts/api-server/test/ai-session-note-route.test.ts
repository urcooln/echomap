import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalDocumentationTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  sessionTranscriptsTable,
  therapySessionsTable,
  transcriptChildUtteranceReviewsTable,
  transcriptSpeakerSegmentsTable,
  usersTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import router from "../src/routes/childled";
import {
  AI_SESSION_NOTE_SOURCE,
} from "../src/lib/ai-session-note";
import {
  DOCUMENTATION_REVIEW_REQUIRED_LABEL,
  DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
} from "../src/lib/documentation-draft";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

type ProviderMode = "success" | "provider_failure" | "parser_failure";

const contentHasSafetyLabels = (content: Record<string, string>) => {
  const interpretationSections = [
    content.nlaObservations,
    content.potentialGestalts,
    content.suggestedClinicalImpressions,
  ];
  return interpretationSections.every((section) =>
    section.includes(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL)
    && section.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL),
  );
};

test.after(async () => {
  await pool.end();
});

test("AI session-note endpoint enforces evidence boundaries and safe documentation transitions", async () => {
  const suffix = randomUUID();
  const userId = `ai-session-route-user-${suffix}`;
  const created = {
    organizationIds: [] as number[],
    childIds: [] as number[],
    sessionIds: [] as number[],
    transcriptIds: [] as number[],
    documentIds: [] as number[],
  };

  const [organization, otherOrganization] = await db.insert(organizationsTable).values([
    { slug: `ai-session-route-${suffix}`, name: "AI session route test organization" },
    { slug: `ai-session-route-other-${suffix}`, name: "Other AI session route organization" },
  ]).returning({ id: organizationsTable.id });
  assert.ok(organization && otherOrganization);
  created.organizationIds.push(organization.id, otherOrganization.id);

  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "ai-session-route-test",
    providerSubject: userId,
    displayName: "AI Route Clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "clinician",
  });

  const [child, otherChild] = await db.insert(childProfilesTable).values([
    { organizationId: organization.id, displayName: "Reviewed Child" },
    { organizationId: organization.id, displayName: "Different Child" },
  ]).returning({ id: childProfilesTable.id });
  assert.ok(child && otherChild);
  created.childIds.push(child.id, otherChild.id);
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: child.id, userId, role: "clinician" },
    { childId: otherChild.id, userId, role: "clinician" },
  ]);

  const createSession = async (label: string) => {
    const [session] = await db.insert(therapySessionsTable).values({
      organizationId: organization.id,
      childId: child.id,
      note: `${label} test session`,
      createdByUserId: userId,
    }).returning({ id: therapySessionsTable.id });
    assert.ok(session);
    created.sessionIds.push(session.id);
    return session.id;
  };

  const createTranscript = async ({
    label,
    segments,
    reviewedSegmentIndexes,
  }: {
    label: string;
    segments: Array<{ text: string; intelligibility?: string }>;
    reviewedSegmentIndexes: number[];
  }) => {
    const sessionId = await createSession(label);
    const [transcript] = await db.insert(sessionTranscriptsTable).values({
      childId: child.id,
      sessionId,
      audioId: `ai-session-route-audio-${suffix}-${label}`,
      createdBy: userId,
      createdByUserId: userId,
      status: "complete",
      speakerSeparationStatus: "complete",
      rawTranscript: segments.map((segment) => segment.text).join(" "),
    }).returning({ id: sessionTranscriptsTable.id });
    assert.ok(transcript);
    created.transcriptIds.push(transcript.id);

    const insertedSegments = await db.insert(transcriptSpeakerSegmentsTable).values(
      segments.map((segment, position) => ({
        transcriptId: transcript.id,
        speakerLabel: "Child",
        text: segment.text,
        position,
        intelligibility: segment.intelligibility ?? "intelligible",
        speakerReviewed: true,
      })),
    ).returning({ id: transcriptSpeakerSegmentsTable.id });
    assert.equal(insertedSegments.length, segments.length);

    if (reviewedSegmentIndexes.length) {
      await db.insert(transcriptChildUtteranceReviewsTable).values(
        reviewedSegmentIndexes.map((index) => ({
          transcriptId: transcript.id,
          segmentId: insertedSegments[index]!.id,
          disposition: "child",
          intelligibilityReviewStatus: "confirmed",
          meaning: `Meaning for ${label} ${index}`,
          context: `Context for ${label} ${index}`,
          reviewedByUserId: userId,
        })),
      );
    }

    return { sessionId, transcriptId: transcript.id };
  };

  const incomplete = await createTranscript({
    label: "incomplete",
    segments: [{ text: "unfinished one" }, { text: "unfinished two" }],
    reviewedSegmentIndexes: [0],
  });
  const emptyEvidence = await createTranscript({
    label: "empty",
    segments: [{ text: "adult turn" }],
    reviewedSegmentIndexes: [],
  });
  await db.insert(transcriptChildUtteranceReviewsTable).values({
    transcriptId: emptyEvidence.transcriptId,
    segmentId: (await db.select({ id: transcriptSpeakerSegmentsTable.id })
      .from(transcriptSpeakerSegmentsTable)
      .where(eq(transcriptSpeakerSegmentsTable.transcriptId, emptyEvidence.transcriptId))
      .limit(1))[0]!.id,
    disposition: "not_child",
    intelligibilityReviewStatus: "confirmed",
    reviewedByUserId: userId,
  });
  const providerFailure = await createTranscript({
    label: "provider-failure",
    segments: [{ text: "provider failure phrase" }],
    reviewedSegmentIndexes: [0],
  });
  const parserFailure = await createTranscript({
    label: "parser-failure",
    segments: [{ text: "parser failure phrase" }],
    reviewedSegmentIndexes: [0],
  });
  const success = await createTranscript({
    label: "success",
    segments: [{ text: "help me" }],
    reviewedSegmentIndexes: [0],
  });

  let currentActor: ResolvedCareTeamActor | undefined;
  const clinician: ResolvedCareTeamActor = {
    userId,
    author: "AI Route Clinician",
    role: "SLP",
    childIds: [child.id],
    isAdmin: false,
    organizationId: organization.id,
    expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = currentActor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let providerMode: ProviderMode = "success";
  let providerCalls = 0;
  const originalCreate = openai.chat.completions.create;
  (openai.chat.completions as typeof openai.chat.completions & {
    create: (params: any) => Promise<any>;
  }).create = async (params: any) => {
    providerCalls += 1;
    if (providerMode === "provider_failure") {
      throw new Error("provider unavailable");
    }
    if (providerMode === "parser_failure") {
      return { choices: [{ message: { content: "{\"unsupported\":true}" } }] };
    }
    const userMessage = params.messages[1]?.content;
    const evidence = JSON.parse(userMessage).reviewedChildUtterances;
    return {
      choices: [{
        message: {
          content: JSON.stringify({
            functionObservations: [{ segmentId: evidence[0].segmentId, category: "requesting" }],
            potentialGestaltSegmentIds: [evidence[0].segmentId],
            nlaObservationCodes: ["variation_observed"],
          }),
        },
      }],
    };
  };

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, init);
    const body = await response.json() as Record<string, any>;
    return { status: response.status, body };
  };
  const postJson = (path: string, body: Record<string, unknown>) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const putJson = (path: string, body: Record<string, unknown>) =>
    request(path, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const aiRequest = (sessionId: number) =>
    postJson("/clinical-documentation/ai-session-note", {
      childId: child.id,
      sessionId,
    });
  const documentsForChild = async () =>
    db.select().from(clinicalDocumentationTable)
      .where(eq(clinicalDocumentationTable.childId, child.id));
  const auditsFor = async (action: string) =>
    db.select().from(securityAuditLogsTable).where(and(
      eq(securityAuditLogsTable.userId, userId),
      eq(securityAuditLogsTable.action, action),
    ));

  try {
    currentActor = clinician;
    const initialDocuments = await documentsForChild();
    const initialProviderCalls = providerCalls;

    currentActor = { ...clinician, organizationId: otherOrganization.id };
    const wrongOrganization = await aiRequest(success.sessionId);
    assert.equal(wrongOrganization.status, 404);
    assert.equal((await documentsForChild()).length, initialDocuments.length);

    currentActor = { ...clinician, childIds: [otherChild.id] };
    const wrongChild = await aiRequest(success.sessionId);
    assert.equal(wrongChild.status, 403);
    assert.equal((await documentsForChild()).length, initialDocuments.length);

    for (const role of ["Parent", "Teacher", "Administrator"] as const) {
      currentActor = { ...clinician, role };
      const unauthorizedRole = await aiRequest(success.sessionId);
      assert.equal(unauthorizedRole.status, 403);
    }
    assert.equal(providerCalls, initialProviderCalls);
    assert.equal((await documentsForChild()).length, initialDocuments.length);

    currentActor = clinician;
    const incompleteResponse = await aiRequest(incomplete.sessionId);
    assert.equal(incompleteResponse.status, 409);
    assert.match(incompleteResponse.body.error, /Complete Child Language Review/);
    assert.equal(providerCalls, initialProviderCalls);
    assert.equal((await documentsForChild()).length, initialDocuments.length);

    const emptyEvidenceResponse = await aiRequest(emptyEvidence.sessionId);
    assert.equal(emptyEvidenceResponse.status, 422);
    assert.match(emptyEvidenceResponse.body.error, /No meaning-backed confirmed Child utterances/);
    assert.equal(providerCalls, initialProviderCalls);
    assert.equal((await documentsForChild()).length, initialDocuments.length);

    const standardResponse = await postJson("/clinical-documentation", {
      childId: child.id,
      format: "session_note",
      inputSummary: "Clinician-authored standard draft.",
    });
    assert.equal(standardResponse.status, 201);
    const [standardDraft] = await db.update(clinicalDocumentationTable)
      .set({ sourceSessionId: success.sessionId })
      .where(eq(clinicalDocumentationTable.id, standardResponse.body.id))
      .returning();
    assert.ok(standardDraft);
    created.documentIds.push(standardDraft.id);
    assert.equal(standardDraft.generationSource, "clinician_input");
    assert.equal(standardDraft.generated, true);

    providerMode = "provider_failure";
    const providerFailureBeforeDocuments = await documentsForChild();
    const providerFailureBeforeAudit = await auditsFor("AI_SESSION_NOTE_DRAFT_CREATED");
    const providerFailureResponse = await aiRequest(providerFailure.sessionId);
    assert.equal(providerFailureResponse.status, 502);
    assert.match(providerFailureResponse.body.error, /could not be generated/);
    assert.equal((await documentsForChild()).length, providerFailureBeforeDocuments.length);
    assert.equal((await auditsFor("AI_SESSION_NOTE_DRAFT_CREATED")).length, providerFailureBeforeAudit.length);

    providerMode = "parser_failure";
    const parserFailureBeforeDocuments = await documentsForChild();
    const parserFailureBeforeAudit = await auditsFor("AI_SESSION_NOTE_DRAFT_CREATED");
    const parserFailureResponse = await aiRequest(parserFailure.sessionId);
    assert.equal(parserFailureResponse.status, 502);
    assert.equal((await documentsForChild()).length, parserFailureBeforeDocuments.length);
    assert.equal((await auditsFor("AI_SESSION_NOTE_DRAFT_CREATED")).length, parserFailureBeforeAudit.length);

    providerMode = "success";
    const documentsBeforeSuccess = await documentsForChild();
    const createdAuditsBeforeSuccess = await auditsFor("AI_SESSION_NOTE_DRAFT_CREATED");
    const sourceRowsBeforeSuccess = await Promise.all([
      db.select().from(therapySessionsTable)
        .where(inArray(therapySessionsTable.id, created.sessionIds)),
      db.select().from(sessionTranscriptsTable)
        .where(inArray(sessionTranscriptsTable.id, created.transcriptIds)),
      db.select().from(transcriptSpeakerSegmentsTable)
        .where(inArray(
          transcriptSpeakerSegmentsTable.transcriptId,
          created.transcriptIds,
        )),
      db.select().from(transcriptChildUtteranceReviewsTable)
        .where(inArray(
          transcriptChildUtteranceReviewsTable.transcriptId,
          created.transcriptIds,
        )),
    ]);
    const successResponse = await aiRequest(success.sessionId);
    assert.equal(successResponse.status, 201);
    const aiDraft = successResponse.body;
    created.documentIds.push(aiDraft.id);
    assert.equal(aiDraft.generated, true);
    assert.equal(aiDraft.status, "draft");
    assert.equal(aiDraft.sourceSessionId, success.sessionId);
    assert.equal((await documentsForChild()).length, documentsBeforeSuccess.length + 1);
    assert.equal((await auditsFor("AI_SESSION_NOTE_DRAFT_CREATED")).length, createdAuditsBeforeSuccess.length + 1);
    const sourceRowsAfterSuccess = await Promise.all([
      db.select().from(therapySessionsTable)
        .where(inArray(therapySessionsTable.id, created.sessionIds)),
      db.select().from(sessionTranscriptsTable)
        .where(inArray(sessionTranscriptsTable.id, created.transcriptIds)),
      db.select().from(transcriptSpeakerSegmentsTable)
        .where(inArray(
          transcriptSpeakerSegmentsTable.transcriptId,
          created.transcriptIds,
        )),
      db.select().from(transcriptChildUtteranceReviewsTable)
        .where(inArray(
          transcriptChildUtteranceReviewsTable.transcriptId,
          created.transcriptIds,
        )),
    ]);
    assert.deepEqual(sourceRowsAfterSuccess, sourceRowsBeforeSuccess);
    assert.notEqual(aiDraft.id, standardDraft.id);
    assert.equal((await db.select().from(clinicalDocumentationTable)
      .where(eq(clinicalDocumentationTable.id, standardDraft.id)))[0]?.generationSource, "clinician_input");
    assert.equal(contentHasSafetyLabels(aiDraft.content), true);
    assert.match(aiDraft.content.sessionSummary, /Evidence used: 1 meaning-backed/);

    const callsAfterSuccess = providerCalls;
    const reopenedAuditsBefore = await auditsFor("AI_SESSION_NOTE_DRAFT_REOPENED");
    const reopenedResponse = await aiRequest(success.sessionId);
    assert.equal(reopenedResponse.status, 200);
    assert.equal(reopenedResponse.body.id, aiDraft.id);
    assert.equal(providerCalls, callsAfterSuccess);
    assert.equal((await auditsFor("AI_SESSION_NOTE_DRAFT_REOPENED")).length, reopenedAuditsBefore.length + 1);

    const unsafeContent = {
      ...aiDraft.content,
      nlaObservations: aiDraft.content.nlaObservations.replace(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL, ""),
    };
    const rejectedSave = await putJson("/clinical-documentation", {
      documentId: aiDraft.id,
      childId: child.id,
      title: "Unsafe edit",
      content: unsafeContent,
    });
    assert.equal(rejectedSave.status, 422);
    assert.equal((await db.select().from(clinicalDocumentationTable)
      .where(eq(clinicalDocumentationTable.id, aiDraft.id)))[0]?.generated, true);

    const safeContent = {
      ...aiDraft.content,
      clinicianNotes: "Clinician reviewed this draft before finalization.",
    };
    const savedAuditsBefore = await auditsFor("CLINICAL_DOCUMENTATION_DRAFT_SAVED");
    const savedResponse = await putJson("/clinical-documentation", {
      documentId: aiDraft.id,
      childId: child.id,
      title: "Reviewed AI session note",
      content: safeContent,
    });
    assert.equal(savedResponse.status, 200);
    assert.equal(savedResponse.body.generated, false);
    assert.equal(contentHasSafetyLabels(savedResponse.body.content), true);
    assert.equal((await auditsFor("CLINICAL_DOCUMENTATION_DRAFT_SAVED")).length, savedAuditsBefore.length + 1);

    const finalizedAuditsBefore = await auditsFor("CLINICAL_DOCUMENTATION_FINALIZED");
    const finalizedResponse = await postJson("/clinical-documentation/approve", {
      documentId: aiDraft.id,
      childId: child.id,
    });
    assert.equal(finalizedResponse.status, 200);
    assert.equal(finalizedResponse.body.status, "finalized");
    assert.equal(contentHasSafetyLabels(finalizedResponse.body.content), true);
    assert.equal((await auditsFor("CLINICAL_DOCUMENTATION_FINALIZED")).length, finalizedAuditsBefore.length + 1);
    const [persistedFinal] = await db.select().from(clinicalDocumentationTable)
      .where(eq(clinicalDocumentationTable.id, aiDraft.id));
    assert.equal(persistedFinal?.status, "finalized");
    assert.equal(contentHasSafetyLabels(persistedFinal?.content as Record<string, string>), true);
    assert.equal(persistedFinal?.generationSource, AI_SESSION_NOTE_SOURCE);
  } finally {
    (openai.chat.completions as typeof openai.chat.completions & {
      create: (params: any) => Promise<any>;
    }).create = originalCreate;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (created.documentIds.length) {
      await db.delete(clinicalDocumentationTable)
        .where(inArray(clinicalDocumentationTable.id, created.documentIds));
    }
    if (created.transcriptIds.length) {
      await db.delete(sessionTranscriptsTable)
        .where(inArray(sessionTranscriptsTable.id, created.transcriptIds));
    }
    if (created.sessionIds.length) {
      await db.delete(therapySessionsTable)
        .where(inArray(therapySessionsTable.id, created.sessionIds));
    }
    await db.delete(securityAuditLogsTable).where(eq(securityAuditLogsTable.userId, userId));
    if (created.childIds.length) {
      await db.delete(childCareTeamMembershipsTable)
        .where(inArray(childCareTeamMembershipsTable.childId, created.childIds));
      await db.delete(childProfilesTable).where(inArray(childProfilesTable.id, created.childIds));
    }
    await db.delete(organizationMembershipsTable).where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    if (created.organizationIds.length) {
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, created.organizationIds));
    }
  }
});