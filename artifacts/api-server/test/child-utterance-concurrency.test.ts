import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import test from "node:test";
import {
  childCareTeamMembershipsTable,
  childPhraseInboxItemsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  clinicalKnowledgeAppliedFactsTable,
  clinicalKnowledgeChunksTable,
  clinicalKnowledgeIngestionJobsTable,
  clinicalKnowledgeInsightRunsTable,
  clinicalKnowledgeInsightsTable,
  clinicalKnowledgeSourcesTable,
  clinicalKnowledgeSourceVersionsTable,
  clinicalSoapNotesTable,
  db,
  gestaltOccurrencesTable,
  iepServiceRequirementsTable,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  sessionAudioObjectsTable,
  sessionTranscriptsTable,
  securityAuditLogsTable,
  therapySessionGestaltsTable,
  therapySessionsTable,
  transcriptChildUtteranceReviewsTable,
  transcriptPhrasesTable,
  transcriptSpeakerRolesTable,
  transcriptSpeakerSegmentsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

type Fixture = {
  organizationId: number;
  childId: number;
  userId: string;
  audioId: string;
  transcriptId: number;
  partialSegmentId: number;
  unintelligibleSegmentId: number;
  phraseId: number;
  phraseInboxItemId?: number;
  clinicalGestaltId: number;
  serviceRequirementId: number;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const makeActor = (
  organizationId: number,
  childId: number,
  userId: string,
): ResolvedCareTeamActor => ({
  userId,
  author: "Concurrency test clinician",
  role: "SLP",
  childIds: [childId],
  isAdmin: false,
  organizationId,
  expiresAt: Date.now() + 60_000,
});

const createFixture = async (): Promise<Fixture> => {
  const suffix = randomUUID();
  const userId = `child-utterance-concurrency-user-${suffix}`;
  const audioId = `child-utterance-concurrency-audio-${suffix}`;
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `child-utterance-concurrency-${suffix}`,
      name: "Child utterance concurrency test organization",
    })
    .returning({ id: organizationsTable.id });
  assert.ok(organization);

  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "child-utterance-concurrency-test",
    providerSubject: userId,
    displayName: "Concurrency test clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "clinician",
  });
  const [child] = await db
    .insert(childProfilesTable)
    .values({
      organizationId: organization.id,
      displayName: "Concurrency test child",
    })
    .returning({ id: childProfilesTable.id });
  assert.ok(child);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: child.id,
    userId,
    role: "clinician",
  });
  const [service] = await db
    .insert(iepServiceRequirementsTable)
    .values({
      organizationId: organization.id,
      childId: child.id,
      serviceType: "individual",
      serviceName: "Individual",
      normalizedServiceName: "individual",
      requiredSessions: 2,
      requiredMinutes: 60,
      sessionDurationMinutes: 30,
      period: "yearly",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning({ id: iepServiceRequirementsTable.id });
  assert.ok(service);
  const [clinicalGestalt] = await db
    .insert(clinicalGestaltsTable)
    .values({
      organizationId: organization.id,
      childId: child.id,
      phrase: "more bubbles",
      normalizedPhrase: "more bubbles",
      meaning: "Requests more bubbles.",
      communicationFunction: "Request",
      contexts: ["Water play"],
      emotionalState: "Engaged",
      source: "Clinician-reviewed classroom dictionary",
      createdByUserId: userId,
    })
    .returning({ id: clinicalGestaltsTable.id });
  assert.ok(clinicalGestalt);
  await db.insert(sessionAudioObjectsTable).values({
    id: audioId,
    organizationId: organization.id,
    childId: child.id,
    purpose: "session_recording",
    storageDriver: "test",
    objectKey: `child-utterance-concurrency/${suffix}`,
    contentType: "audio/wav",
    sizeBytes: 1,
    status: "ready",
    uploadedByUserId: userId,
    consentConfirmedAt: new Date(),
    consentConfirmedByUserId: userId,
  });
  const [transcript] = await db
    .insert(sessionTranscriptsTable)
    .values({
      childId: child.id,
      audioId,
      createdBy: "Concurrency test clinician",
      createdByUserId: userId,
      status: "complete",
      speakerSeparationStatus: "manual",
      rawTranscript: "more bubbles [unintelligible]",
    })
    .returning({ id: sessionTranscriptsTable.id });
  assert.ok(transcript);
  const [partialSegment, unintelligibleSegment] = await db
    .insert(transcriptSpeakerSegmentsTable)
    .values([
      {
        transcriptId: transcript.id,
        speakerLabel: "Speaker A",
        text: "more bubbles",
        position: 0,
        speakerConfidence: "high",
        speakerConfidenceScore: 99,
        intelligibility: "partially_intelligible",
        transcriptionConfidenceScore: 88,
        speakerReviewed: true,
      },
      {
        transcriptId: transcript.id,
        speakerLabel: "Speaker A",
        text: "",
        position: 1,
        speakerConfidence: "high",
        speakerConfidenceScore: 99,
        intelligibility: "unintelligible",
        transcriptionConfidenceScore: 10,
        speakerReviewed: true,
      },
    ])
    .returning({ id: transcriptSpeakerSegmentsTable.id });
  assert.ok(partialSegment);
  assert.ok(unintelligibleSegment);
  await db.insert(transcriptSpeakerRolesTable).values({
    transcriptId: transcript.id,
    speakerLabel: "Speaker A",
    role: "child",
  });
  await db.insert(transcriptChildUtteranceReviewsTable).values([
    {
      transcriptId: transcript.id,
      segmentId: partialSegment.id,
      disposition: "confirmed_gestalt",
      intelligibilityReviewStatus: "confirmed",
      meaning: "Requests more bubbles.",
      reviewedByUserId: userId,
    },
    {
      transcriptId: transcript.id,
      segmentId: unintelligibleSegment.id,
      disposition: "unintelligible",
      intelligibilityReviewStatus: "unlabeled",
      reviewedByUserId: userId,
    },
  ]);
  const [phrase] = await db
    .insert(transcriptPhrasesTable)
    .values({
      transcriptId: transcript.id,
      phrase: "more bubbles",
      normalizedPhrase: "more bubbles",
      attributedRole: "child",
    })
    .returning({ id: transcriptPhrasesTable.id });
  assert.ok(phrase);

  return {
    organizationId: organization.id,
    childId: child.id,
    userId,
    audioId,
    transcriptId: transcript.id,
    partialSegmentId: partialSegment.id,
    unintelligibleSegmentId: unintelligibleSegment.id,
    phraseId: phrase.id,
    clinicalGestaltId: clinicalGestalt.id,
    serviceRequirementId: service.id,
  };
};

const createTestApp = (actor: ResolvedCareTeamActor) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = actor;
    next();
  });
  app.use(router);
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: error.message });
  });
  return app;
};

const requestReview = async (
  baseUrl: string,
  fixture: Fixture,
  disposition: "not_gestalt" | "confirmed_gestalt",
) => {
  const [transcript] = await db
    .select({ updatedAt: sessionTranscriptsTable.updatedAt })
    .from(sessionTranscriptsTable)
    .where(eq(sessionTranscriptsTable.id, fixture.transcriptId));
  assert.ok(transcript);
  const response = await fetch(
    `${baseUrl}/sessions/transcription/child-utterances?childId=${fixture.childId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcriptId: fixture.transcriptId,
        expectedUpdatedAt: transcript.updatedAt.toISOString(),
        reviews: [
          {
            segmentId: fixture.partialSegmentId,
            disposition,
            intelligibilityReviewStatus:
              disposition === "confirmed_gestalt" ? "confirmed" : "pending",
            meaning:
              disposition === "confirmed_gestalt"
                ? "Requests more bubbles."
                : null,
          },
          {
            segmentId: fixture.unintelligibleSegmentId,
            disposition: "unintelligible",
            intelligibilityReviewStatus: "unlabeled",
          },
        ],
      }),
    },
  );
  return { status: response.status, body: await response.text() };
};

type NlaStage = "stage_0" | "stage_1" | "stage_2" | "stage_3" | "stage_4_plus";

const requestNlaStage = async (
  baseUrl: string,
  fixture: Fixture,
  segmentId: number,
  disposition: "confirmed_gestalt" | "not_gestalt" | "unintelligible",
  nlaStage: NlaStage | null,
) => {
  const [transcript] = await db
    .select({ updatedAt: sessionTranscriptsTable.updatedAt })
    .from(sessionTranscriptsTable)
    .where(eq(sessionTranscriptsTable.id, fixture.transcriptId));
  assert.ok(transcript);
  const response = await fetch(
    `${baseUrl}/sessions/transcription/child-utterances?childId=${fixture.childId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcriptId: fixture.transcriptId,
        expectedUpdatedAt: transcript.updatedAt.toISOString(),
        reviews: [
          {
            segmentId,
            disposition,
            intelligibilityReviewStatus:
              disposition === "confirmed_gestalt"
                ? "confirmed"
                : disposition === "unintelligible"
                  ? "unlabeled"
                  : "pending",
            meaning:
              disposition === "confirmed_gestalt"
                ? "Requests more bubbles."
                : null,
            nlaStage,
          },
        ],
      }),
    },
  );
  return {
    status: response.status,
    body: await response.text(),
  };
};

const requestSave = async (baseUrl: string, fixture: Fixture) => {
  const response = await fetch(
    `${baseUrl}/sessions?childId=${fixture.childId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceRequirementId: fixture.serviceRequirementId,
        durationSeconds: 60,
        gestalts: [
          {
            phrase: "more bubbles",
            meaning: "Requests more bubbles.",
            function: "Request",
            context: "Water play",
            emotionalState: "Engaged",
            note: "",
            transcriptPhraseId: fixture.phraseId,
            phraseInboxItemId: fixture.phraseInboxItemId,
            preserveDictionary: true,
            clinicianReviewed: true,
          },
        ],
        clinicalObservations: "",
        nextSteps: "",
        note: "Concurrency test session",
        audioId: fixture.audioId,
        transcriptionId: fixture.transcriptId,
        consentConfirmed: true,
        consentConfirmedAt: new Date().toISOString(),
      }),
    },
  );
  return { status: response.status, body: await response.text() };
};

const withTranscriptLock = async (
  transcriptId: number,
  startFirstRequest: () => Promise<{ status: number; body: string }>,
  startSecondRequest: () => Promise<{ status: number; body: string }>,
) => {
  let releaseLock!: () => void;
  let signalLockAcquired!: () => void;
  const lockReleased = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const lockAcquired = new Promise<void>((resolve) => {
    signalLockAcquired = resolve;
  });
  const lockTransaction = db.transaction(async (transaction) => {
    await transaction
      .select({ id: sessionTranscriptsTable.id })
      .from(sessionTranscriptsTable)
      .where(eq(sessionTranscriptsTable.id, transcriptId))
      .for("update");
    signalLockAcquired();
    await lockReleased;
  });
  await lockAcquired;
  const first = startFirstRequest();
  // Let the first route pass its non-locking preflight queries and queue on the
  // transcript row before the competing route starts.
  await sleep(150);
  const second = startSecondRequest();
  await sleep(150);
  releaseLock();
  const [firstResponse, secondResponse] = await Promise.all([
    first,
    second,
    lockTransaction,
  ]);
  return { first: firstResponse, second: secondResponse };
};

const cleanupFixture = async (fixture: Fixture) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const runs = await db
      .select({ status: clinicalKnowledgeInsightRunsTable.status })
      .from(clinicalKnowledgeInsightRunsTable)
      .where(eq(clinicalKnowledgeInsightRunsTable.childId, fixture.childId));
    if (
      !runs.length ||
      runs.every((run) => run.status === "completed" || run.status === "failed")
    ) {
      break;
    }
    await sleep(50);
  }
  await db
    .delete(clinicalKnowledgeInsightsTable)
    .where(eq(clinicalKnowledgeInsightsTable.childId, fixture.childId));
  await db
    .delete(clinicalKnowledgeAppliedFactsTable)
    .where(eq(clinicalKnowledgeAppliedFactsTable.childId, fixture.childId));
  await db
    .delete(clinicalKnowledgeInsightRunsTable)
    .where(eq(clinicalKnowledgeInsightRunsTable.childId, fixture.childId));
  await db
    .delete(clinicalSoapNotesTable)
    .where(eq(clinicalSoapNotesTable.childId, fixture.childId));
  const knowledgeSources = await db
    .select({ id: clinicalKnowledgeSourcesTable.id })
    .from(clinicalKnowledgeSourcesTable)
    .where(
      eq(clinicalKnowledgeSourcesTable.organizationId, fixture.organizationId),
    );
  if (knowledgeSources.length) {
    const sourceIds = knowledgeSources.map((source) => source.id);
    const sourceVersions = await db
      .select({ id: clinicalKnowledgeSourceVersionsTable.id })
      .from(clinicalKnowledgeSourceVersionsTable)
      .where(inArray(clinicalKnowledgeSourceVersionsTable.sourceId, sourceIds));
    if (sourceVersions.length) {
      const sourceVersionIds = sourceVersions.map((version) => version.id);
      await db
        .delete(clinicalKnowledgeIngestionJobsTable)
        .where(
          inArray(
            clinicalKnowledgeIngestionJobsTable.sourceVersionId,
            sourceVersionIds,
          ),
        );
      await db
        .delete(clinicalKnowledgeChunksTable)
        .where(
          inArray(
            clinicalKnowledgeChunksTable.sourceVersionId,
            sourceVersionIds,
          ),
        );
      await db
        .delete(clinicalKnowledgeSourceVersionsTable)
        .where(
          inArray(clinicalKnowledgeSourceVersionsTable.id, sourceVersionIds),
        );
    }
    await db
      .delete(clinicalKnowledgeSourcesTable)
      .where(inArray(clinicalKnowledgeSourcesTable.id, sourceIds));
  }
  const sessions = await db
    .select({ id: therapySessionsTable.id })
    .from(therapySessionsTable)
    .where(eq(therapySessionsTable.childId, fixture.childId));
  if (sessions.length) {
    await db.delete(therapySessionGestaltsTable).where(
      inArray(
        therapySessionGestaltsTable.sessionId,
        sessions.map((session) => session.id),
      ),
    );
    await db.delete(therapySessionsTable).where(
      inArray(
        therapySessionsTable.id,
        sessions.map((session) => session.id),
      ),
    );
  }
  await db
    .delete(gestaltOccurrencesTable)
    .where(eq(gestaltOccurrencesTable.childId, fixture.childId));
  await db
    .delete(clinicalGestaltsTable)
    .where(eq(clinicalGestaltsTable.childId, fixture.childId));
  await db
    .delete(iepServiceRequirementsTable)
    .where(eq(iepServiceRequirementsTable.id, fixture.serviceRequirementId));
  await db
    .delete(transcriptPhrasesTable)
    .where(eq(transcriptPhrasesTable.transcriptId, fixture.transcriptId));
  await db
    .delete(sessionTranscriptsTable)
    .where(eq(sessionTranscriptsTable.id, fixture.transcriptId));
  await db
    .delete(sessionAudioObjectsTable)
    .where(eq(sessionAudioObjectsTable.id, fixture.audioId));
  await db
    .delete(childCareTeamMembershipsTable)
    .where(eq(childCareTeamMembershipsTable.childId, fixture.childId));
  await db
    .delete(childProfilesTable)
    .where(eq(childProfilesTable.id, fixture.childId));
  await db
    .delete(organizationMembershipsTable)
    .where(eq(organizationMembershipsTable.userId, fixture.userId));
  await db
    .delete(securityAuditLogsTable)
    .where(eq(securityAuditLogsTable.userId, fixture.userId));
  await db.delete(usersTable).where(eq(usersTable.id, fixture.userId));
  await db
    .delete(organizationsTable)
    .where(eq(organizationsTable.id, fixture.organizationId));
};

test.after(async () => {
  await pool.end();
});

test("keeps confirmed Child phrases idempotent, deferred, audited, and outside dictionary save", async () => {
  const fixture = await createFixture();
  const server = createTestApp(
    makeActor(fixture.organizationId, fixture.childId, fixture.userId),
  ).listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const firstReview = await requestReview(
      baseUrl,
      fixture,
      "confirmed_gestalt",
    );
    assert.equal(firstReview.status, 200);
    const firstRows = await db
      .select()
      .from(childPhraseInboxItemsTable)
      .where(eq(childPhraseInboxItemsTable.transcriptId, fixture.transcriptId));
    assert.equal(firstRows.length, 1);
    assert.equal(firstRows[0]?.status, "pending");
    assert.equal(firstRows[0]?.workingMeaning, "Requests more bubbles.");

    const repeatedReview = await requestReview(
      baseUrl,
      fixture,
      "confirmed_gestalt",
    );
    assert.equal(repeatedReview.status, 200);
    const repeatedRows = await db
      .select()
      .from(childPhraseInboxItemsTable)
      .where(eq(childPhraseInboxItemsTable.transcriptId, fixture.transcriptId));
    assert.equal(repeatedRows.length, 1);
    assert.equal(repeatedRows[0]?.id, firstRows[0]?.id);
    const [rebuiltPhrase] = await db
      .select({ id: transcriptPhrasesTable.id })
      .from(transcriptPhrasesTable)
      .where(eq(transcriptPhrasesTable.transcriptId, fixture.transcriptId));
    assert.ok(rebuiltPhrase);
    fixture.phraseId = rebuiltPhrase.id;
    fixture.phraseInboxItemId = firstRows[0]!.id;

    const listResponse = await fetch(
      `${baseUrl}/sessions/transcription/phrase-inbox?childId=${fixture.childId}&transcriptId=${fixture.transcriptId}`,
    );
    assert.equal(listResponse.status, 200);
    const listed = (await listResponse.json()) as Array<
      Record<string, unknown>
    >;
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, firstRows[0]!.id);
    assert.equal(listed[0]?.status, "pending");
    assert.equal(listed[0]?.sourceLabel, "Confirmed Child transcript");
    assert.equal(listed[0]?.childId, fixture.childId);
    assert.equal(listed[0]?.transcriptId, fixture.transcriptId);
    assert.equal(listed[0]?.segmentId, fixture.partialSegmentId);
    assert.equal(listed[0]?.phrase, "more bubbles");
    assert.equal(listed[0]?.workingMeaning, "Requests more bubbles.");
    assert.equal(listed[0]?.reviewDisposition, "confirmed_gestalt");

    const deferResponse = await fetch(
      `${baseUrl}/sessions/transcription/phrase-inbox/${firstRows[0]!.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "deferred" }),
      },
    );
    assert.equal(deferResponse.status, 200);
    const deferred = (await deferResponse.json()) as {
      item: { status: string; workingMeaning: string | null };
    };
    assert.equal(deferred.item.status, "deferred");
    assert.equal(deferred.item.workingMeaning, "Requests more bubbles.");
    assert.deepEqual(
      await db
        .select({ id: transcriptPhrasesTable.id })
        .from(transcriptPhrasesTable)
        .where(eq(transcriptPhrasesTable.transcriptId, fixture.transcriptId)),
      [],
    );

    const returnResponse = await fetch(
      `${baseUrl}/sessions/transcription/phrase-inbox/${firstRows[0]!.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      },
    );
    assert.equal(returnResponse.status, 200);
    const returned = (await returnResponse.json()) as {
      item: {
        status: string;
        workingMeaning: string | null;
        transcriptPhraseId: number | null;
      };
    };
    assert.equal(returned.item.status, "pending");
    assert.equal(returned.item.workingMeaning, "Requests more bubbles.");
    assert.equal(typeof returned.item.transcriptPhraseId, "number");
    fixture.phraseId = returned.item.transcriptPhraseId!;
    assert.equal(
      (
        await db
          .select({ id: transcriptPhrasesTable.id })
          .from(transcriptPhrasesTable)
          .where(eq(transcriptPhrasesTable.id, fixture.phraseId))
      ).length,
      1,
    );

    const deferAgainResponse = await fetch(
      `${baseUrl}/sessions/transcription/phrase-inbox/${firstRows[0]!.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "deferred" }),
      },
    );
    assert.equal(deferAgainResponse.status, 200);

    const save = await requestSave(baseUrl, fixture);
    assert.match(
      save.body,
      /Only transcript phrases rebuilt from clinician-confirmed Child speaker turns/u,
    );
    assert.equal(save.status, 400);
    assert.equal(
      (
        await db
          .select({ id: therapySessionsTable.id })
          .from(therapySessionsTable)
          .where(eq(therapySessionsTable.childId, fixture.childId))
      ).length,
      0,
    );
    const audits = await db
      .select({ action: securityAuditLogsTable.action })
      .from(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, fixture.userId));
    assert.equal(
      audits.some((audit) => audit.action === "CHILD_PHRASE_INBOX_UPDATED"),
      true,
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanupFixture(fixture);
  }
});

test("assigns, revises, clears, and audits optional NLA stages without changing evidence eligibility", async () => {
  const fixture = await createFixture();
  const server = createTestApp(
    makeActor(fixture.organizationId, fixture.childId, fixture.userId),
  ).listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const stages: NlaStage[] = [
    "stage_0",
    "stage_1",
    "stage_2",
    "stage_3",
    "stage_4_plus",
  ];

  try {
    for (const stage of stages) {
      const response = await requestNlaStage(
        baseUrl,
        fixture,
        fixture.partialSegmentId,
        "confirmed_gestalt",
        stage,
      );
      assert.equal(response.status, 200);
      const transcript = JSON.parse(response.body) as {
        childUtterances: Array<{
          segmentId: number;
          nlaStage: NlaStage | null;
        }>;
      };
      assert.equal(
        transcript.childUtterances.find(
          (item) => item.segmentId === fixture.partialSegmentId,
        )?.nlaStage,
        stage,
      );
    }

    const [assigned] = await db
      .select({
        nlaStage: transcriptChildUtteranceReviewsTable.nlaStage,
        assignedByUserId:
          transcriptChildUtteranceReviewsTable.nlaStageAssignedByUserId,
        assignedByRole:
          transcriptChildUtteranceReviewsTable.nlaStageAssignedByRole,
        assignedAt: transcriptChildUtteranceReviewsTable.nlaStageAssignedAt,
      })
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        eq(
          transcriptChildUtteranceReviewsTable.segmentId,
          fixture.partialSegmentId,
        ),
      );
    assert.deepEqual(
      {
        nlaStage: assigned?.nlaStage,
        assignedByUserId: assigned?.assignedByUserId,
        assignedByRole: assigned?.assignedByRole,
        assignedAtPresent: assigned?.assignedAt instanceof Date,
      },
      {
        nlaStage: "stage_4_plus",
        assignedByUserId: fixture.userId,
        assignedByRole: "SLP",
        assignedAtPresent: true,
      },
    );

    const phraseBeforeClear = await db
      .select({ id: transcriptPhrasesTable.id })
      .from(transcriptPhrasesTable)
      .where(eq(transcriptPhrasesTable.transcriptId, fixture.transcriptId));
    assert.equal(phraseBeforeClear.length, 1);

    const cleared = await requestNlaStage(
      baseUrl,
      fixture,
      fixture.partialSegmentId,
      "confirmed_gestalt",
      null,
    );
    assert.equal(cleared.status, 200);
    const clearedTranscript = JSON.parse(cleared.body) as {
      childUtterances: Array<{ segmentId: number; nlaStage: NlaStage | null }>;
    };
    assert.equal(
      clearedTranscript.childUtterances.find(
        (item) => item.segmentId === fixture.partialSegmentId,
      )?.nlaStage,
      null,
    );
    const [clearedRow] = await db
      .select({
        nlaStage: transcriptChildUtteranceReviewsTable.nlaStage,
        assignedByUserId:
          transcriptChildUtteranceReviewsTable.nlaStageAssignedByUserId,
        assignedByRole:
          transcriptChildUtteranceReviewsTable.nlaStageAssignedByRole,
        assignedAt: transcriptChildUtteranceReviewsTable.nlaStageAssignedAt,
      })
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        eq(
          transcriptChildUtteranceReviewsTable.segmentId,
          fixture.partialSegmentId,
        ),
      );
    assert.deepEqual(clearedRow, {
      nlaStage: null,
      assignedByUserId: null,
      assignedByRole: null,
      assignedAt: null,
    });
    assert.equal(
      (
        await db
          .select({ id: transcriptPhrasesTable.id })
          .from(transcriptPhrasesTable)
          .where(eq(transcriptPhrasesTable.transcriptId, fixture.transcriptId))
      ).length,
      phraseBeforeClear.length,
    );

    const invalidNotChild = await requestNlaStage(
      baseUrl,
      fixture,
      fixture.partialSegmentId,
      "not_gestalt",
      "stage_1",
    );
    assert.equal(invalidNotChild.status, 400);
    assert.match(
      invalidNotChild.body,
      /confirmed as intelligible Child language/u,
    );

    const invalidUnintelligible = await requestNlaStage(
      baseUrl,
      fixture,
      fixture.unintelligibleSegmentId,
      "unintelligible",
      "stage_1",
    );
    assert.equal(invalidUnintelligible.status, 400);
    assert.match(
      invalidUnintelligible.body,
      /confirmed as intelligible Child language/u,
    );

    const audits = await db
      .select({
        action: securityAuditLogsTable.action,
        actorRole: securityAuditLogsTable.actorRole,
        childId: securityAuditLogsTable.childId,
        metadata: securityAuditLogsTable.metadata,
        occurredAt: securityAuditLogsTable.occurredAt,
      })
      .from(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, fixture.userId));
    const stageAudits = audits.filter(
      (audit) =>
        audit.action === "TRANSCRIPT_CHILD_UTTERANCE_NLA_STAGE_CHANGED",
    );
    assert.equal(stageAudits.length, 6);
    assert.equal(
      stageAudits.every((audit) => audit.actorRole === "SLP"),
      true,
    );
    assert.equal(
      stageAudits.every((audit) => audit.childId === fixture.childId),
      true,
    );
    assert.equal(
      stageAudits.every((audit) => audit.occurredAt instanceof Date),
      true,
    );
    assert.equal(
      stageAudits.every(
        (audit) =>
          audit.metadata.organizationId === fixture.organizationId &&
          audit.metadata.transcriptId === fixture.transcriptId &&
          audit.metadata.sessionId === null &&
          audit.metadata.segmentId === fixture.partialSegmentId,
      ),
      true,
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanupFixture(fixture);
  }
});

test("does not expose NLA review data across organizations", async () => {
  const fixture = await createFixture();
  const actor = makeActor(
    fixture.organizationId + 1_000_000,
    fixture.childId,
    fixture.userId,
  );
  const server = createTestApp(actor).listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await requestNlaStage(
      baseUrl,
      fixture,
      fixture.partialSegmentId,
      "confirmed_gestalt",
      "stage_1",
    );
    assert.equal(response.status, 404);
    const [review] = await db
      .select({
        nlaStage: transcriptChildUtteranceReviewsTable.nlaStage,
      })
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        eq(
          transcriptChildUtteranceReviewsTable.segmentId,
          fixture.partialSegmentId,
        ),
      );
    assert.equal(review?.nlaStage, null);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanupFixture(fixture);
  }
});

test("serializes Child utterance revocation before session save and never saves revoked evidence", async () => {
  const fixture = await createFixture();
  const server = createTestApp(
    makeActor(fixture.organizationId, fixture.childId, fixture.userId),
  ).listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const { first: review, second: save } = await withTranscriptLock(
      fixture.transcriptId,
      () => requestReview(baseUrl, fixture, "not_gestalt"),
      () => requestSave(baseUrl, fixture),
    );
    assert.equal(review.status, 200);
    assert.equal(save.status, 500);
    assert.match(
      save.body,
      /Transcript evidence must come from a meaning-backed confirmed Child utterance review/u,
    );

    const [transcript] = await db
      .select({
        sessionId: sessionTranscriptsTable.sessionId,
      })
      .from(sessionTranscriptsTable)
      .where(eq(sessionTranscriptsTable.id, fixture.transcriptId));
    assert.ok(transcript);
    assert.equal(transcript.sessionId, null);
    assert.deepEqual(
      await db
        .select({ id: transcriptPhrasesTable.id })
        .from(transcriptPhrasesTable)
        .where(eq(transcriptPhrasesTable.transcriptId, fixture.transcriptId)),
      [],
    );
    assert.equal(
      (
        await db
          .select({ id: therapySessionsTable.id })
          .from(therapySessionsTable)
          .where(eq(therapySessionsTable.childId, fixture.childId))
      ).length,
      0,
    );
    assert.deepEqual(
      await db
        .select({
          disposition: transcriptChildUtteranceReviewsTable.disposition,
          intelligibilityReviewStatus:
            transcriptChildUtteranceReviewsTable.intelligibilityReviewStatus,
        })
        .from(transcriptChildUtteranceReviewsTable)
        .where(
          eq(
            transcriptChildUtteranceReviewsTable.transcriptId,
            fixture.transcriptId,
          ),
        )
        .orderBy(transcriptChildUtteranceReviewsTable.segmentId),
      [
        {
          disposition: "not_gestalt",
          intelligibilityReviewStatus: "pending",
        },
        {
          disposition: "unintelligible",
          intelligibilityReviewStatus: "unlabeled",
        },
      ],
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanupFixture(fixture);
  }
});

test("serializes session save before a later Child utterance review without changing saved evidence", async () => {
  const fixture = await createFixture();
  const server = createTestApp(
    makeActor(fixture.organizationId, fixture.childId, fixture.userId),
  ).listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const { first: save, second: review } = await withTranscriptLock(
      fixture.transcriptId,
      () => requestSave(baseUrl, fixture),
      () => requestReview(baseUrl, fixture, "not_gestalt"),
    );
    assert.equal(save.status, 201);
    assert.equal(review.status, 500);
    assert.match(
      review.body,
      /Child utterance review is locked after this transcript is saved/u,
    );

    const [transcript] = await db
      .select({
        sessionId: sessionTranscriptsTable.sessionId,
      })
      .from(sessionTranscriptsTable)
      .where(eq(sessionTranscriptsTable.id, fixture.transcriptId));
    assert.ok(transcript);
    assert.notEqual(transcript.sessionId, null);
    const evidence = await db
      .select({
        phrase: therapySessionGestaltsTable.phrase,
        childAttributed: therapySessionGestaltsTable.childAttributed,
        transcriptPhraseId: therapySessionGestaltsTable.transcriptPhraseId,
      })
      .from(therapySessionGestaltsTable)
      .where(eq(therapySessionGestaltsTable.sessionId, transcript.sessionId!));
    assert.deepEqual(evidence, [
      {
        phrase: "more bubbles",
        childAttributed: true,
        transcriptPhraseId: fixture.phraseId,
      },
    ]);
    assert.equal(
      evidence.some(
        (item) =>
          item.phrase === "" || item.phrase === "Unintelligible vocalization",
      ),
      false,
    );
    assert.deepEqual(
      await db
        .select({
          disposition: transcriptChildUtteranceReviewsTable.disposition,
          intelligibilityReviewStatus:
            transcriptChildUtteranceReviewsTable.intelligibilityReviewStatus,
        })
        .from(transcriptChildUtteranceReviewsTable)
        .where(
          eq(
            transcriptChildUtteranceReviewsTable.transcriptId,
            fixture.transcriptId,
          ),
        )
        .orderBy(transcriptChildUtteranceReviewsTable.segmentId),
      [
        {
          disposition: "confirmed_gestalt",
          intelligibilityReviewStatus: "confirmed",
        },
        {
          disposition: "unintelligible",
          intelligibilityReviewStatus: "unlabeled",
        },
      ],
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanupFixture(fixture);
  }
});
