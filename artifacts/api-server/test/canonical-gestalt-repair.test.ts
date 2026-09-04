import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  aacVocabularyPlanningTable,
  childProfilesTable,
  clinicalGestaltsTable,
  db,
  gestaltCollaborationNotesTable,
  gestaltOccurrencesTable,
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
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ensureCanonicalGestaltIndex } from "../src/lib/canonical-gestalt-index";
import { repairCanonicalGestaltsForChild } from "../src/lib/canonical-gestalt-repair";

test.after(async () => {
  await pool.end();
});

test("repairs legacy punctuation variants without duplicating their evidence", async () => {
  // This is the deployment-startup guard that runs before any write route can
  // call the repair. It makes retained archived variants compatible with the
  // active canonical phrase before the test creates its legacy pair.
  await ensureCanonicalGestaltIndex();
  const suffix = randomUUID();
  const userId = `canonical-repair-user-${suffix}`;
  const createdAt = new Date("2026-08-20T10:00:00.000Z");
  const [organization] = await db.insert(organizationsTable)
    .values({ slug: `canonical-repair-${suffix}`, name: "Canonical repair test organization" })
    .returning({ id: organizationsTable.id });
  assert.ok(organization);
  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "canonical-repair-test",
    providerSubject: userId,
    displayName: "Canonical repair clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "clinician",
  });
  const [child] = await db.insert(childProfilesTable)
    .values({ organizationId: organization.id, displayName: "Canonical repair child" })
    .returning({ id: childProfilesTable.id });
  assert.ok(child);

  const created = {
    gestaltIds: [] as number[],
    sessionId: undefined as number | undefined,
    transcriptId: undefined as number | undefined,
    transcriptPhraseId: undefined as number | undefined,
  };
  try {
    const gestalts = await db.insert(clinicalGestaltsTable).values([
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "Blast off!",
        normalizedPhrase: "blast off!",
        meaning: "A clinician-reviewed transition script",
        communicationFunction: "Transition",
        contexts: ["Outdoor play"],
        emotionalState: "Excited",
        source: "Clinician-reviewed session",
        createdByUserId: userId,
        createdAt,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        phrase: "Blast off",
        normalizedPhrase: "blast off",
        meaning: "Care-team observation awaiting clinician review",
        communicationFunction: "Not yet reviewed",
        contexts: ["Classroom"],
        emotionalState: "Not documented",
        source: "teacher observation · clinician review pending",
        createdByUserId: userId,
        createdAt: new Date("2026-08-21T10:00:00.000Z"),
      },
    ]).returning();
    const reviewed = gestalts[0]!;
    const duplicate = gestalts[1]!;
    created.gestaltIds.push(reviewed.id, duplicate.id);

    const [session] = await db.insert(therapySessionsTable).values({
      organizationId: organization.id,
      childId: child.id,
      note: "Reviewed phrase evidence",
      createdByUserId: userId,
      createdAt,
    }).returning({ id: therapySessionsTable.id });
    assert.ok(session);
    created.sessionId = session.id;
    const [transcript] = await db.insert(sessionTranscriptsTable).values({
      childId: child.id,
      sessionId: session.id,
      audioId: `canonical-repair-audio-${suffix}`,
      createdBy: userId,
      createdByUserId: userId,
      status: "complete",
      speakerSeparationStatus: "complete",
      rawTranscript: "Blast off!",
    }).returning({ id: sessionTranscriptsTable.id });
    assert.ok(transcript);
    created.transcriptId = transcript.id;
    const [transcriptPhrase] = await db.insert(transcriptPhrasesTable).values({
      transcriptId: transcript.id,
      phrase: "Blast off!",
      normalizedPhrase: "blast off",
      frequency: 2,
      attributedRole: "child",
      matchedGestaltId: duplicate.id,
    }).returning({ id: transcriptPhrasesTable.id });
    assert.ok(transcriptPhrase);
    created.transcriptPhraseId = transcriptPhrase.id;
    await db.insert(therapySessionGestaltsTable).values({
      sessionId: session.id,
      transcriptPhraseId: transcriptPhrase.id,
      gestaltId: duplicate.id,
      phrase: "Blast off!",
      meaning: "A clinician-reviewed transition script",
      communicationFunction: "Transition",
      context: "Outdoor play",
      emotionalState: "Excited",
      note: "",
      childAttributed: true,
    });
    await db.insert(gestaltCollaborationNotesTable).values({
      organizationId: organization.id,
      childId: child.id,
      gestaltId: duplicate.id,
      authorUserId: userId,
      authorName: "Canonical repair clinician",
      authorRole: "SLP",
      body: "Observed at dismissal.",
    });
    await db.insert(phraseObservationsTable).values({
      organizationId: organization.id,
      childId: child.id,
      gestaltId: duplicate.id,
      observedAt: new Date("2026-08-22T10:00:00.000Z"),
      context: "Classroom",
      authorUserId: userId,
      authorName: "Canonical repair clinician",
      authorRole: "Teacher",
    });
    await db.insert(gestaltOccurrencesTable).values([
      {
        childId: child.id,
        gestaltId: reviewed.id,
        phrase: reviewed.phrase,
        normalizedPhrase: reviewed.normalizedPhrase,
        occurrenceCount: 2,
      },
      {
        childId: child.id,
        gestaltId: duplicate.id,
        phrase: duplicate.phrase,
        normalizedPhrase: duplicate.normalizedPhrase,
        occurrenceCount: 1,
      },
    ]);
    await db.insert(aacVocabularyPlanningTable).values({
      organizationId: organization.id,
      childId: child.id,
      gestaltId: duplicate.id,
      status: "review_later",
      createdByUserId: userId,
    });

    const result = await db.transaction((transaction) =>
      repairCanonicalGestaltsForChild(transaction, organization.id, child.id));
    assert.equal(result.archivedCount, 1);
    assert.equal(result.canonicalIdForGestaltId.get(duplicate.id), reviewed.id);

    const active = await db.select().from(clinicalGestaltsTable).where(and(
      eq(clinicalGestaltsTable.childId, child.id),
      isNull(clinicalGestaltsTable.archivedAt),
    ));
    assert.equal(active.length, 1);
    assert.equal(active[0]?.id, reviewed.id);
    assert.equal(active[0]?.normalizedPhrase, "blast off");
    assert.deepEqual(active[0]?.contexts, ["Outdoor play", "Classroom"]);

    const [sessionPhrase] = await db.select().from(therapySessionGestaltsTable)
      .where(eq(therapySessionGestaltsTable.sessionId, session.id));
    const [matchedPhrase] = await db.select().from(transcriptPhrasesTable)
      .where(eq(transcriptPhrasesTable.id, transcriptPhrase.id));
    const [note] = await db.select().from(gestaltCollaborationNotesTable)
      .where(eq(gestaltCollaborationNotesTable.childId, child.id));
    const [observation] = await db.select().from(phraseObservationsTable)
      .where(eq(phraseObservationsTable.childId, child.id));
    const occurrences = await db.select().from(gestaltOccurrencesTable)
      .where(eq(gestaltOccurrencesTable.childId, child.id));
    assert.equal(sessionPhrase?.gestaltId, reviewed.id);
    assert.equal(matchedPhrase?.matchedGestaltId, reviewed.id);
    assert.equal(note?.gestaltId, reviewed.id);
    assert.equal(observation?.gestaltId, reviewed.id);
    assert.equal(occurrences.length, 1);
    assert.equal(occurrences[0]?.gestaltId, reviewed.id);
    assert.equal(occurrences[0]?.occurrenceCount, 3);
    const [planning] = await db.select().from(aacVocabularyPlanningTable)
      .where(eq(aacVocabularyPlanningTable.childId, child.id));
    assert.equal(planning?.gestaltId, reviewed.id);
    assert.equal(planning?.status, "review_later");
  } finally {
    await db.delete(aacVocabularyPlanningTable).where(eq(aacVocabularyPlanningTable.childId, child.id));
    if (created.sessionId) {
      await db.delete(therapySessionGestaltsTable)
        .where(eq(therapySessionGestaltsTable.sessionId, created.sessionId));
    }
    if (created.transcriptPhraseId) {
      await db.delete(transcriptPhrasesTable)
        .where(eq(transcriptPhrasesTable.id, created.transcriptPhraseId));
    }
    if (created.transcriptId) {
      await db.delete(sessionTranscriptsTable)
        .where(eq(sessionTranscriptsTable.id, created.transcriptId));
    }
    if (created.sessionId) {
      await db.delete(therapySessionsTable)
        .where(eq(therapySessionsTable.id, created.sessionId));
    }
    await db.delete(phraseObservationsTable).where(eq(phraseObservationsTable.childId, child.id));
    await db.delete(gestaltCollaborationNotesTable).where(eq(gestaltCollaborationNotesTable.childId, child.id));
    await db.delete(gestaltOccurrencesTable).where(eq(gestaltOccurrencesTable.childId, child.id));
    if (created.gestaltIds.length) {
      await db.delete(clinicalGestaltsTable)
        .where(inArray(clinicalGestaltsTable.id, created.gestaltIds));
    }
    await db.delete(childProfilesTable).where(eq(childProfilesTable.id, child.id));
    await db.delete(organizationMembershipsTable)
      .where(and(
        eq(organizationMembershipsTable.organizationId, organization.id),
        eq(organizationMembershipsTable.userId, userId),
      ));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
  }
});