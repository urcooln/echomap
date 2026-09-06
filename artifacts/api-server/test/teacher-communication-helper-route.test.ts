import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  db,
  gestaltOccurrencesTable,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  sessionAudioObjectsTable,
  sessionTranscriptsTable,
  teamMessagesTable,
  therapySessionGestaltsTable,
  therapySessionsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

const makeActor = (
  userId: string,
  author: string,
  role: ResolvedCareTeamActor["role"],
  organizationId: number,
  childIds: number[],
): ResolvedCareTeamActor => ({
  userId,
  author,
  role,
  childIds,
  isAdmin: false,
  organizationId,
  expiresAt: Date.now() + 60_000,
});

test.after(async () => {
  await pool.end();
});

test("Teacher communication helper keeps restricted care-team content out of its response", async () => {
  const suffix = randomUUID();
  const organizationSlug = `teacher-helper-${suffix}`;
  const userIds = {
    clinician: `teacher-helper-clinician-${suffix}`,
    teacher: `teacher-helper-teacher-${suffix}`,
    parent: `teacher-helper-parent-${suffix}`,
    unassigned: `teacher-helper-unassigned-${suffix}`,
  };
  const created = {
    organizationId: undefined as number | undefined,
    childId: undefined as number | undefined,
    sessionId: undefined as number | undefined,
    transcriptId: undefined as number | undefined,
    audioId: `teacher-helper-audio-${suffix}`,
    recordingId: `teacher-helper-recording-${suffix}`,
    gestaltIds: [] as number[],
    teamMessageIds: [] as number[],
  };

  const [organization] = await db
    .insert(organizationsTable)
    .values({ slug: organizationSlug, name: "Teacher helper test organization" })
    .returning({ id: organizationsTable.id });
  assert.ok(organization);
  created.organizationId = organization.id;

  await db.insert(usersTable).values([
    {
      id: userIds.clinician,
      identityProvider: "teacher-helper-test",
      providerSubject: userIds.clinician,
      displayName: "Restricted Creator Identity",
    },
    {
      id: userIds.teacher,
      identityProvider: "teacher-helper-test",
      providerSubject: userIds.teacher,
      displayName: "Assigned Classroom Teacher",
    },
    {
      id: userIds.parent,
      identityProvider: "teacher-helper-test",
      providerSubject: userIds.parent,
      displayName: "Assigned Parent",
    },
    {
      id: userIds.unassigned,
      identityProvider: "teacher-helper-test",
      providerSubject: userIds.unassigned,
      displayName: "Unassigned Teacher",
    },
  ]);
  await db.insert(organizationMembershipsTable).values([
    { organizationId: organization.id, userId: userIds.clinician, role: "clinician" },
    { organizationId: organization.id, userId: userIds.teacher, role: "teacher" },
    { organizationId: organization.id, userId: userIds.parent, role: "parent" },
    { organizationId: organization.id, userId: userIds.unassigned, role: "teacher" },
  ]);
  const [child] = await db
    .insert(childProfilesTable)
    .values({
      organizationId: organization.id,
      displayName: "Teacher helper student",
      school: "Maple Grove",
      grade: "1",
      profileDetails: {
        interestEntries: [
          {
            id: `interest-${suffix}`,
            interest: "Bubbles",
            status: "approved",
            addedAt: new Date().toISOString(),
            addedBy: "Restricted Creator Identity",
            addedByRole: "SLP",
            addedByUserId: userIds.clinician,
          },
        ],
      },
    })
    .returning({ id: childProfilesTable.id });
  assert.ok(child);
  created.childId = child.id;
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: child.id, userId: userIds.teacher, role: "teacher" },
    { childId: child.id, userId: userIds.parent, role: "parent" },
  ]);

  const [session] = await db
    .insert(therapySessionsTable)
    .values({
      organizationId: organization.id,
      childId: child.id,
      note: "RAW_SESSION_WORDING_SHOULD_NOT_APPEAR",
      clinicalObservations: "PRIVATE_CLINICAL_OBSERVATION_SHOULD_NOT_APPEAR",
      nextSteps: "PRIVATE_NEXT_STEPS_SHOULD_NOT_APPEAR",
      createdByUserId: userIds.clinician,
    })
    .returning({ id: therapySessionsTable.id });
  assert.ok(session);
  created.sessionId = session.id;

  const [transcript] = await db
    .insert(sessionTranscriptsTable)
    .values({
      childId: child.id,
      sessionId: session.id,
      audioId: created.audioId,
      createdBy: userIds.clinician,
      createdByUserId: userIds.clinician,
      status: "complete",
      speakerSeparationStatus: "complete",
      rawTranscript: "RAW_TRANSCRIPT_WORDING_SHOULD_NOT_APPEAR",
    })
    .returning({ id: sessionTranscriptsTable.id });
  assert.ok(transcript);
  created.transcriptId = transcript.id;
  await db.insert(sessionAudioObjectsTable).values({
    id: created.recordingId,
    organizationId: organization.id,
    childId: child.id,
    sessionId: session.id,
    storageDriver: "test",
    objectKey: "PRIVATE_RECORDING_OBJECT_SHOULD_NOT_APPEAR",
    contentType: "audio/wav",
    sizeBytes: 12,
    status: "attached",
    uploadedByUserId: userIds.clinician,
    consentConfirmedAt: new Date(),
    consentConfirmedByUserId: userIds.clinician,
  });

  const dictionaryRecords = await db
    .insert(clinicalGestaltsTable)
    .values([
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "more bubbles",
        normalizedPhrase: "more bubbles",
        meaning: "A request for more bubbles.",
        communicationFunction: "Request",
        contexts: ["Water play"],
        emotionalState: "Engaged",
        source: "Clinician-reviewed classroom dictionary",
        createdByUserId: userIds.clinician,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "more bubbles during assessment",
        normalizedPhrase: "more bubbles during assessment",
        meaning: "AI confidence stage 3 transcript recording — RESTRICTED_DICTIONARY_SENTINEL",
        communicationFunction: "NLA stage indicator",
        contexts: ["Private assessment transcript context — RESTRICTED_CONTEXT_SENTINEL"],
        emotionalState: "RESTRICTED",
        source: "Clinician-reviewed classroom dictionary",
        createdByUserId: userIds.clinician,
      },
    ])
    .returning({ id: clinicalGestaltsTable.id });
  created.gestaltIds.push(...dictionaryRecords.map((record) => record.id));

  let currentActor: ResolvedCareTeamActor | undefined;
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
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const requestHelper = async (
    actor: ResolvedCareTeamActor | undefined,
  ) => {
    currentActor = actor;
    const response = await fetch(
      `${baseUrl}/teacher/communication-helper?childId=${child.id}&phrase=more%20bubbles`,
    );
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  };
  const sendTeamMessage = async (messageType: "question" | "notification", body: string) => {
    currentActor = makeActor(
      userIds.teacher,
      "Assigned Classroom Teacher",
      "Teacher",
      organization.id,
      [child.id],
    );
    const response = await fetch(`${baseUrl}/team-inbox`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId: child.id, body, messageType }),
    });
    assert.equal(response.status, 201);
    const result = await response.json() as { id: number };
    created.teamMessageIds.push(result.id);
  };

  try {
    await sendTeamMessage(
      "question",
      "Question about more bubbles: RAW_TEAM_QUESTION_BODY_SHOULD_NOT_APPEAR",
    );
    await sendTeamMessage(
      "notification",
      "Clinician alert about more bubbles: RAW_CLINICIAN_ALERT_BODY_SHOULD_NOT_APPEAR",
    );

    const storedIntents = await db
      .select({
        id: teamMessagesTable.id,
        messageType: teamMessagesTable.messageType,
      })
      .from(teamMessagesTable)
      .where(inArray(teamMessagesTable.id, created.teamMessageIds));
    assert.deepEqual(
      storedIntents
        .sort((left, right) => left.id - right.id)
        .map((message) => message.messageType),
      ["question", "notification"],
    );

    const authorized = await requestHelper(makeActor(
      userIds.teacher,
      "Assigned Classroom Teacher",
      "Teacher",
      organization.id,
      [child.id],
    ));
    assert.equal(authorized.status, 200);
    assert.equal(authorized.body.found, true);
    assert.deepEqual(authorized.body.meanings, [
      { text: "A request for more bubbles.", source: "communication_dictionary" },
    ]);
    assert.deepEqual(authorized.body.observedIn, ["Water play"]);
    assert.deepEqual(authorized.body.relatedInterests, ["Bubbles"]);
    assert.deepEqual(authorized.body.sources.sort(), ["communication_dictionary", "team_notes"]);
    assert.deepEqual(
      authorized.body.teamInsights.map((insight: Record<string, unknown>) => ({
        authorRole: insight.authorRole,
        body: insight.body,
      })),
      [
        {
          authorRole: "Teacher",
          body: "A clinician notification is available in Team Communication.",
        },
        {
          authorRole: "Teacher",
          body: "A team question is available in Team Communication.",
        },
      ],
    );

    const responseText = JSON.stringify(authorized.body);
    for (const restrictedValue of [
      "RAW_SESSION_WORDING_SHOULD_NOT_APPEAR",
      "PRIVATE_CLINICAL_OBSERVATION_SHOULD_NOT_APPEAR",
      "PRIVATE_NEXT_STEPS_SHOULD_NOT_APPEAR",
      "RAW_TRANSCRIPT_WORDING_SHOULD_NOT_APPEAR",
      "PRIVATE_RECORDING_OBJECT_SHOULD_NOT_APPEAR",
      "more bubbles during assessment",
      "RESTRICTED_DICTIONARY_SENTINEL",
      "RESTRICTED_CONTEXT_SENTINEL",
      "RAW_TEAM_QUESTION_BODY_SHOULD_NOT_APPEAR",
      "RAW_CLINICIAN_ALERT_BODY_SHOULD_NOT_APPEAR",
      "Restricted Creator Identity",
    ]) {
      assert.equal(responseText.includes(restrictedValue), false, restrictedValue);
    }

    const parentDenied = await requestHelper(makeActor(
      userIds.parent,
      "Assigned Parent",
      "Parent",
      organization.id,
      [child.id],
    ));
    assert.equal(parentDenied.status, 403);
    assert.equal(parentDenied.body.error, "This classroom helper is available to assigned teachers.");

    const unassignedDenied = await requestHelper(makeActor(
      userIds.unassigned,
      "Unassigned Teacher",
      "Teacher",
      organization.id,
      [],
    ));
    assert.equal(unassignedDenied.status, 403);
    assert.equal(unassignedDenied.body.error, "This care-team role does not have access to this child.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (created.teamMessageIds.length) {
      await db.delete(teamMessagesTable)
        .where(inArray(teamMessagesTable.id, created.teamMessageIds));
    }
    if (created.gestaltIds.length) {
      await db.delete(gestaltOccurrencesTable)
        .where(inArray(gestaltOccurrencesTable.gestaltId, created.gestaltIds));
      await db.delete(clinicalGestaltsTable)
        .where(inArray(clinicalGestaltsTable.id, created.gestaltIds));
    }
    if (created.transcriptId !== undefined) {
      await db.delete(sessionTranscriptsTable)
        .where(eq(sessionTranscriptsTable.id, created.transcriptId));
    }
    if (created.sessionId !== undefined) {
      await db.delete(therapySessionGestaltsTable)
        .where(eq(therapySessionGestaltsTable.sessionId, created.sessionId));
      await db.delete(sessionAudioObjectsTable)
        .where(eq(sessionAudioObjectsTable.id, created.recordingId));
      await db.delete(therapySessionsTable)
        .where(eq(therapySessionsTable.id, created.sessionId));
    }
    if (created.childId !== undefined) {
      await db.delete(childCareTeamMembershipsTable)
        .where(eq(childCareTeamMembershipsTable.childId, created.childId));
      await db.delete(childProfilesTable)
        .where(eq(childProfilesTable.id, created.childId));
    }
    await db.delete(organizationMembershipsTable)
      .where(inArray(organizationMembershipsTable.userId, Object.values(userIds)));
    await db.delete(usersTable)
      .where(inArray(usersTable.id, Object.values(userIds)));
    if (created.organizationId !== undefined) {
      await db.delete(organizationsTable)
        .where(eq(organizationsTable.id, created.organizationId));
    }
  }
});