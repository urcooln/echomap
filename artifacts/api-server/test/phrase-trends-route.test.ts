import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  phraseObservationsTable,
  pool,
  sessionTranscriptsTable,
  therapySessionGestaltsTable,
  therapySessionsTable,
  transcriptPhrasesTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import router from "../src/routes/echomap";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

const makeActor = (
  organizationId: number,
  childIds: number[],
): ResolvedCareTeamActor => ({
  userId: `task-34-user-${randomUUID()}`,
  author: "Task 34 test clinician",
  role: "SLP",
  childIds,
  isAdmin: false,
  organizationId,
  expiresAt: Date.now() + 60_000,
});

test.after(async () => {
  await pool.end();
});

test("phrase trends return only confirmed Child evidence from an organization-scoped request", async () => {
  const slug = `task-34-${randomUUID()}`;
  const otherSlug = `task-34-other-${randomUUID()}`;
  const userId = `task-34-db-user-${randomUUID()}`;
  const audioPrefix = `task-34-audio-${randomUUID()}`;
  const created = {
    organizationIds: [] as number[],
    childId: undefined as number | undefined,
    clinicalGestaltIds: [] as number[],
    phraseObservationIds: [] as number[],
    sessionIds: [] as number[],
    transcriptIds: [] as number[],
    transcriptPhraseIds: [] as number[],
  };

  const [organization] = await db
    .insert(organizationsTable)
    .values({ slug, name: "Task 34 test organization" })
    .returning({ id: organizationsTable.id });
  const [otherOrganization] = await db
    .insert(organizationsTable)
    .values({ slug: otherSlug, name: "Task 34 other organization" })
    .returning({ id: organizationsTable.id });
  assert.ok(organization);
  assert.ok(otherOrganization);
  created.organizationIds.push(organization.id, otherOrganization.id);

  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "task-34-test",
    providerSubject: userId,
    displayName: "Task 34 test clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "clinician",
  });
  const [child] = await db
    .insert(childProfilesTable)
    .values({ organizationId: organization.id, displayName: "Task 34 child" })
    .returning({ id: childProfilesTable.id });
  assert.ok(child);
  created.childId = child.id;
  await db.insert(childCareTeamMembershipsTable).values({
    childId: child.id,
    userId,
    role: "clinician",
  });
  const clinicalGestalts = await db
    .insert(clinicalGestaltsTable)
    .values([
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "More bubbles",
        normalizedPhrase: "more bubbles",
        meaning: "Request more bubbles",
        communicationFunction: "Request",
        contexts: ["Water play"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "More snacks",
        normalizedPhrase: "more snacks",
        meaning: "Request more snacks",
        communicationFunction: "Request",
        contexts: ["Snack time"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "Fruit time",
        normalizedPhrase: "fruit time",
        meaning: "Comment on fruit",
        communicationFunction: "Comment",
        contexts: ["Snack time"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "Secret banana",
        normalizedPhrase: "secret banana",
        meaning: "Meaning awaits clinician review.",
        communicationFunction: "Connection",
        contexts: ["Home"],
        emotionalState: "Not documented",
        source: "Clinician-reviewed classroom dictionary",
        createdByUserId: userId,
      },
    ])
    .returning({ id: clinicalGestaltsTable.id });
  created.clinicalGestaltIds.push(...clinicalGestalts.map((gestalt) => gestalt.id));
  const [bubblesGestalt, snacksGestalt, fruitGestalt, pendingGestalt] = clinicalGestalts;
  assert.ok(bubblesGestalt);
  assert.ok(snacksGestalt);
  assert.ok(fruitGestalt);
  assert.ok(pendingGestalt);
  const phraseObservations = await db
    .insert(phraseObservationsTable)
    .values([
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: bubblesGestalt.id,
        observedAt: new Date("2026-08-19T10:00:00.000Z"),
        context: "Outdoor play",
        communicationFunction: "Comment",
        authorUserId: userId,
        authorName: "Task 34 test clinician",
        authorRole: "SLP",
      },
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: fruitGestalt.id,
        observedAt: new Date("2026-08-20T10:00:00.000Z"),
        context: "Snack time",
        communicationFunction: "Comment",
        authorUserId: userId,
        authorName: "Task 34 test clinician",
        authorRole: "SLP",
      },
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: pendingGestalt.id,
        observedAt: new Date("2026-08-24T10:00:00.000Z"),
        context: "Home",
        communicationFunction: null,
        authorUserId: userId,
        authorName: "Task 34 test clinician",
        authorRole: "Teacher",
      },
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: bubblesGestalt.id,
        observedAt: new Date("2026-08-22T10:00:00.000Z"),
        context: "Water play",
        communicationFunction: "Request",
        authorUserId: userId,
        authorName: "Task 34 test clinician",
        authorRole: "SLP",
      },
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: snacksGestalt.id,
        observedAt: new Date("2026-08-21T10:00:00.000Z"),
        context: "Snack time",
        communicationFunction: "Request",
        authorUserId: userId,
        authorName: "Task 34 test clinician",
        authorRole: "SLP",
      },
    ])
    .returning({ id: phraseObservationsTable.id });
  created.phraseObservationIds.push(...phraseObservations.map((observation) => observation.id));

  const [firstSession] = await db
    .insert(therapySessionsTable)
    .values({
      organizationId: organization.id,
      childId: child.id,
      note: "Mixed-speaker session one",
      createdByUserId: userId,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
    })
    .returning({ id: therapySessionsTable.id });
  const [secondSession] = await db
    .insert(therapySessionsTable)
    .values({
      organizationId: organization.id,
      childId: child.id,
      note: "Mixed-speaker session two",
      createdByUserId: userId,
      createdAt: new Date("2026-08-21T10:00:00.000Z"),
    })
    .returning({ id: therapySessionsTable.id });
  assert.ok(firstSession);
  assert.ok(secondSession);
  created.sessionIds.push(firstSession.id, secondSession.id);

  const [firstTranscript] = await db
    .insert(sessionTranscriptsTable)
    .values({
      childId: child.id,
      sessionId: firstSession.id,
      audioId: `${audioPrefix}-one`,
      createdBy: userId,
      createdByUserId: userId,
      status: "complete",
      speakerSeparationStatus: "complete",
      rawTranscript: "More bubbles. More bubbles. More snacks.",
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
    })
    .returning({ id: sessionTranscriptsTable.id });
  const [secondTranscript] = await db
    .insert(sessionTranscriptsTable)
    .values({
      childId: child.id,
      sessionId: secondSession.id,
      audioId: `${audioPrefix}-two`,
      createdBy: userId,
      createdByUserId: userId,
      status: "complete",
      speakerSeparationStatus: "complete",
      rawTranscript: "More bubbles.",
      createdAt: new Date("2026-08-21T10:00:00.000Z"),
    })
    .returning({ id: sessionTranscriptsTable.id });
  assert.ok(firstTranscript);
  assert.ok(secondTranscript);
  created.transcriptIds.push(firstTranscript.id, secondTranscript.id);

  const transcriptPhrases = await db
    .insert(transcriptPhrasesTable)
    .values([
      {
        transcriptId: firstTranscript.id,
        phrase: "More bubbles",
        normalizedPhrase: "more bubbles",
        frequency: 3,
        attributedRole: "child",
      },
      {
        transcriptId: firstTranscript.id,
        phrase: "More bubbles",
        normalizedPhrase: "more bubbles adult",
        frequency: 99,
        attributedRole: "adult",
      },
      {
        transcriptId: firstTranscript.id,
        phrase: "More snacks",
        normalizedPhrase: "more snacks",
        frequency: 50,
        attributedRole: "unassigned",
      },
      {
        transcriptId: secondTranscript.id,
        phrase: "More bubbles",
        normalizedPhrase: "more bubbles second session",
        frequency: 2,
        attributedRole: "child",
      },
    ])
    .returning({ id: transcriptPhrasesTable.id });
  created.transcriptPhraseIds.push(...transcriptPhrases.map((phrase) => phrase.id));

  await db.insert(therapySessionGestaltsTable).values([
    {
      sessionId: firstSession.id,
      transcriptPhraseId: transcriptPhrases[0]!.id,
      phrase: "More bubbles",
      meaning: "Request more bubbles",
      communicationFunction: "Request",
      context: "Water play",
      emotionalState: "Engaged",
      note: "",
      childAttributed: true,
    },
    {
      sessionId: firstSession.id,
      transcriptPhraseId: transcriptPhrases[1]!.id,
      phrase: "More bubbles",
      meaning: "Adult speech must not appear",
      communicationFunction: "Comment",
      context: "Adult conversation",
      emotionalState: "Neutral",
      note: "",
      childAttributed: false,
    },
    {
      sessionId: firstSession.id,
      transcriptPhraseId: transcriptPhrases[2]!.id,
      phrase: "More snacks",
      meaning: "Unreviewed speech must not appear",
      communicationFunction: "Request",
      context: "Unreviewed conversation",
      emotionalState: "Unknown",
      note: "",
      childAttributed: false,
    },
    {
      sessionId: secondSession.id,
      transcriptPhraseId: transcriptPhrases[3]!.id,
      phrase: "More bubbles",
      meaning: "Request more bubbles",
      communicationFunction: "Request",
      context: "Bath time",
      emotionalState: "Engaged",
      note: "",
      childAttributed: true,
    },
  ]);

  let currentActor: ResolvedCareTeamActor | undefined;
  const app = express();
  app.use((req, _res, next) => {
    req.echomapActor = currentActor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const requestTrends = async (
    actor: ResolvedCareTeamActor | undefined,
    childId: number,
  ) => {
    currentActor = actor;
    const response = await fetch(
      `${baseUrl}/phrase-trends?childId=${childId}&from=2026-08-20&to=2026-08-21T23%3A59%3A59.999Z`,
    );
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  };
  const requestFrequentScripts = async (
    actor: ResolvedCareTeamActor | undefined,
    childId: number,
  ) => {
    currentActor = actor;
    const response = await fetch(
      `${baseUrl}/frequent-scripts?childId=${childId}&window=all`,
    );
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  };
  const requestRecurringPatterns = async (
    actor: ResolvedCareTeamActor | undefined,
    childId: number,
  ) => {
    currentActor = actor;
    const response = await fetch(
      `${baseUrl}/recurring-language-patterns?childId=${childId}&window=all`,
    );
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  };
  const requestRecurringPatternDetail = async (
    actor: ResolvedCareTeamActor | undefined,
    childId: number,
    patternId: string,
  ) => {
    currentActor = actor;
    const response = await fetch(
      `${baseUrl}/recurring-language-pattern-detail?childId=${childId}&patternId=${encodeURIComponent(patternId)}&window=all`,
    );
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  };

  try {
    const authorized = await requestTrends(
      makeActor(organization.id, [child.id]),
      child.id,
    );
    assert.equal(authorized.status, 200);
    assert.equal(authorized.body.reviewedSessionCount, 2);
    assert.deepEqual(authorized.body.trends, [
      {
        phrase: "More bubbles",
        gestaltId: null,
        totalOccurrences: 5,
        contexts: ["Water play", "Bath time"],
        points: [
          { date: "2026-08-20", occurrences: 3 },
          { date: "2026-08-21", occurrences: 2 },
        ],
        meanings: [
          {
            date: "2026-08-20",
            meaning: "Request more bubbles",
            context: "Water play",
            occurrences: 3,
          },
          {
            date: "2026-08-21",
            meaning: "Request more bubbles",
            context: "Bath time",
            occurrences: 2,
          },
        ],
      },
    ]);
    assert.equal(authorized.body.functionTimeline.length, 2);
    assert.equal(authorized.body.functionTimeline[0].occurrences, 3);
    assert.equal(authorized.body.functionTimeline[1].occurrences, 2);
    assert.equal(JSON.stringify(authorized.body).includes("Adult conversation"), false);
    assert.equal(JSON.stringify(authorized.body).includes("More snacks"), false);

    const frequent = await requestFrequentScripts(
      makeActor(organization.id, [child.id]),
      child.id,
    );
    assert.equal(frequent.status, 200);
    assert.equal(frequent.body.reviewedDictionaryPhraseCount, 3);
    assert.equal(frequent.body.totalObservations, 9);
    assert.deepEqual(
      frequent.body.phrases.map((phrase: Record<string, any>) => ({
        phrase: phrase.phrase,
        observations: phrase.observations,
        frequencyRank: phrase.frequencyRank,
        firstObservedAt: phrase.firstObservedAt,
        lastObservedAt: phrase.lastObservedAt,
        communicationFunctions: phrase.communicationFunctions,
      })),
      [
        {
          phrase: "More bubbles",
          observations: 7,
          frequencyRank: 1,
          firstObservedAt: "2026-08-19T10:00:00.000Z",
          lastObservedAt: "2026-08-22T10:00:00.000Z",
          communicationFunctions: ["Request", "Comment"],
        },
        {
          phrase: "More snacks",
          observations: 1,
          frequencyRank: 2,
          firstObservedAt: "2026-08-21T10:00:00.000Z",
          lastObservedAt: "2026-08-21T10:00:00.000Z",
          communicationFunctions: ["Request"],
        },
        {
          phrase: "Fruit time",
          observations: 1,
          frequencyRank: 3,
          firstObservedAt: "2026-08-20T10:00:00.000Z",
          lastObservedAt: "2026-08-20T10:00:00.000Z",
          communicationFunctions: ["Comment"],
        },
      ],
    );
    assert.equal(JSON.stringify(frequent.body).includes("Secret banana"), false);

    const patternGestalts = await db.insert(clinicalGestaltsTable).values([
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "I want bubbles",
        normalizedPhrase: "i want bubbles",
        meaning: "Request bubbles",
        communicationFunction: "Request",
        contexts: ["Clinic"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "I want snacks",
        normalizedPhrase: "i want snacks",
        meaning: "Request snacks",
        communicationFunction: "Request",
        contexts: ["Home"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "I want hidden",
        normalizedPhrase: "i want hidden",
        meaning: "Archived merged phrase",
        communicationFunction: "Request",
        contexts: ["Archived setting"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
        archivedAt: new Date("2026-08-24T10:00:00.000Z"),
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "Ready, set, go",
        normalizedPhrase: "ready set go",
        meaning: "Signals the start of an activity",
        communicationFunction: "Transition",
        contexts: ["Therapy"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "I'm ready",
        normalizedPhrase: "im ready",
        meaning: "Communicates readiness",
        communicationFunction: "Comment",
        contexts: ["Home"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "Ready for school",
        normalizedPhrase: "ready for school",
        meaning: "Communicates readiness for school",
        communicationFunction: "Transition",
        contexts: ["School"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "Get ready",
        normalizedPhrase: "get ready",
        meaning: "Signals preparation",
        communicationFunction: "Direct",
        contexts: ["Home", "School"],
        emotionalState: "Engaged",
        source: "Clinician review",
        createdByUserId: userId,
      },
    ]).returning({ id: clinicalGestaltsTable.id });
    created.clinicalGestaltIds.push(...patternGestalts.map((gestalt) => gestalt.id));
    const patternObservations = await db.insert(phraseObservationsTable).values([
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: patternGestalts[0]!.id,
        observedAt: new Date("2026-08-25T10:00:00.000Z"),
        context: "Clinic",
        communicationFunction: "Request",
        authorUserId: userId,
        authorName: "Task 112 test clinician",
        authorRole: "SLP",
      },
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: patternGestalts[1]!.id,
        observedAt: new Date("2026-08-26T10:00:00.000Z"),
        context: "Home",
        communicationFunction: "Request",
        authorUserId: userId,
        authorName: "Task 112 test clinician",
        authorRole: "SLP",
      },
      {
        organizationId: organization.id,
        childId: child.id,
        gestaltId: patternGestalts[2]!.id,
        observedAt: new Date("2026-08-27T10:00:00.000Z"),
        context: "Archived setting",
        communicationFunction: "Request",
        authorUserId: userId,
        authorName: "Task 112 test clinician",
        authorRole: "SLP",
      },
    ]).returning({ id: phraseObservationsTable.id });
    created.phraseObservationIds.push(...patternObservations.map((observation) => observation.id));

    const recurring = await requestRecurringPatterns(
      makeActor(organization.id, [child.id]),
      child.id,
    );
    assert.equal(recurring.status, 200);
    const wantPattern = recurring.body.patterns.find(
      (pattern: Record<string, any>) => pattern.id === "pattern-i-want",
    );
    assert.deepEqual(wantPattern, {
      id: "pattern-i-want",
      fragment: "i want",
      phraseCount: 2,
      totalOccurrences: 2,
      firstObservedAt: "2026-08-25T10:00:00.000Z",
      lastObservedAt: "2026-08-26T10:00:00.000Z",
      examplePhrases: ["I want bubbles", "I want snacks"],
      settings: ["Clinic", "Home"],
      reviewedSessionCount: 0,
      environmentCount: 2,
      communicationFunctions: ["Request"],
      communicationFunctionCount: 1,
      indicators: ["Appears Across Multiple Phrases", "Appears Across Multiple Settings"],
    });
    const readyPattern = recurring.body.patterns.find(
      (pattern: Record<string, any>) => pattern.id === "pattern-ready",
    );
    assert.ok(readyPattern);
    assert.equal(readyPattern.totalOccurrences, 4);
    assert.equal(readyPattern.phraseCount, 4);
    assert.equal(readyPattern.reviewedSessionCount, 0);
    assert.deepEqual(readyPattern.settings, ["Home", "School", "Therapy"]);
    assert.deepEqual(readyPattern.communicationFunctions, ["Comment", "Direct", "Transition"]);
    assert.deepEqual(readyPattern.indicators, [
      "Appears Across Multiple Phrases",
      "Appears Across Multiple Settings",
    ]);

    const recurringDetail = await requestRecurringPatternDetail(
      makeActor(organization.id, [child.id]),
      child.id,
      "pattern-i-want",
    );
    assert.equal(recurringDetail.status, 200);
    assert.equal(recurringDetail.body.phrases.length, 2);
    assert.equal(recurringDetail.body.observations.length, 2);
    assert.equal(JSON.stringify(recurringDetail.body).includes("Secret banana"), false);
    assert.equal(JSON.stringify(recurringDetail.body).includes("I want hidden"), false);

    const readyDetail = await requestRecurringPatternDetail(
      makeActor(organization.id, [child.id]),
      child.id,
      "pattern-ready",
    );
    assert.equal(readyDetail.status, 200);
    assert.equal(readyDetail.body.phrases.length, 4);
    assert.equal(readyDetail.body.observations.length, 4);
    assert.ok(readyDetail.body.observations.every(
      (item: Record<string, any>) => item.evidenceType === "dictionary",
    ));

    const parentDenied = await requestRecurringPatterns(
      { ...makeActor(organization.id, [child.id]), role: "Parent" },
      child.id,
    );
    assert.equal(parentDenied.status, 403);

    const detailDenied = await requestRecurringPatternDetail(
      makeActor(organization.id, []),
      child.id,
      "pattern-i-want",
    );
    assert.equal(detailDenied.status, 403);

    const deniedChild = await requestTrends(
      makeActor(organization.id, []),
      child.id,
    );
    assert.equal(deniedChild.status, 403);
    assert.equal(deniedChild.body.error, "This care-team role does not have access to this child.");

    const wrongOrganization = await requestTrends(
      makeActor(otherOrganization.id, [child.id]),
      child.id,
    );
    assert.equal(wrongOrganization.status, 200);
    assert.equal(wrongOrganization.body.reviewedSessionCount, 0);
    assert.deepEqual(wrongOrganization.body.trends, []);
    assert.deepEqual(wrongOrganization.body.functionTimeline, []);

    const wrongOrganizationFrequent = await requestFrequentScripts(
      makeActor(otherOrganization.id, [child.id]),
      child.id,
    );
    assert.equal(wrongOrganizationFrequent.status, 404);
    assert.equal(wrongOrganizationFrequent.body.error, "Child not found");

    const wrongOrganizationRecurring = await requestRecurringPatterns(
      makeActor(otherOrganization.id, [child.id]),
      child.id,
    );
    assert.equal(wrongOrganizationRecurring.status, 404);
    assert.equal(wrongOrganizationRecurring.body.error, "Child not found");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (created.sessionIds.length) {
      await db.delete(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, created.sessionIds));
    }
    if (created.phraseObservationIds.length) {
      await db.delete(phraseObservationsTable)
        .where(inArray(phraseObservationsTable.id, created.phraseObservationIds));
    }
    if (created.clinicalGestaltIds.length) {
      await db.delete(clinicalGestaltsTable)
        .where(inArray(clinicalGestaltsTable.id, created.clinicalGestaltIds));
    }
    if (created.transcriptPhraseIds.length) {
      await db.delete(transcriptPhrasesTable)
        .where(inArray(transcriptPhrasesTable.id, created.transcriptPhraseIds));
    }
    if (created.transcriptIds.length) {
      await db.delete(sessionTranscriptsTable)
        .where(inArray(sessionTranscriptsTable.id, created.transcriptIds));
    }
    if (created.sessionIds.length) {
      await db.delete(therapySessionsTable)
        .where(inArray(therapySessionsTable.id, created.sessionIds));
    }
    if (created.childId !== undefined) {
      await db.delete(childCareTeamMembershipsTable)
        .where(eq(childCareTeamMembershipsTable.childId, created.childId));
      await db.delete(childProfilesTable)
        .where(eq(childProfilesTable.id, created.childId));
    }
    await db.delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.delete(organizationsTable)
      .where(inArray(organizationsTable.id, created.organizationIds));
  }
});