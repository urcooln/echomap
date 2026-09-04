import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  aacVocabularyPlanningTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  db,
  gestaltOccurrencesTable,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/echomap";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("AAC planning transitions stay child-scoped and preserve dictionary evidence", async () => {
  const suffix = randomUUID();
  const userId = `aac-planning-user-${suffix}`;
  const [organization] = await db.insert(organizationsTable).values({
    slug: `aac-planning-${suffix}`,
    name: "AAC planning test organization",
  }).returning();
  assert.ok(organization);
  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "aac-planning-test",
    providerSubject: userId,
    displayName: "AAC planning clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "clinician",
  });
  const [child] = await db.insert(childProfilesTable).values({
    organizationId: organization.id,
    displayName: "AAC planning child",
  }).returning();
  assert.ok(child);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: child.id,
    userId,
    role: "clinician",
  });
  const [gestalt] = await db.insert(clinicalGestaltsTable).values({
    organizationId: organization.id,
    childId: child.id,
    phrase: "Help me",
    normalizedPhrase: "help me",
    meaning: "Requests assistance",
    communicationFunction: "Request",
    contexts: ["School", "Therapy"],
    emotionalState: "Regulated",
    source: "Clinician review",
    createdByUserId: userId,
  }).returning();
  assert.ok(gestalt);
  await db.insert(gestaltOccurrencesTable).values({
    childId: child.id,
    gestaltId: gestalt.id,
    phrase: gestalt.phrase,
    normalizedPhrase: gestalt.normalizedPhrase,
    occurrenceCount: 3,
    lastSeenAt: new Date("2026-08-27T12:00:00.000Z"),
  });

  let currentActor: ResolvedCareTeamActor = {
    userId,
    author: "AAC planning clinician",
    role: "SLP",
    childIds: [child.id],
    isAdmin: false,
    organizationId: organization.id,
    expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.echomapActor = currentActor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const create = await fetch(`${base}/aac-planning`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId: child.id, gestaltId: gestalt.id }),
    });
    assert.equal(create.status, 201);
    const candidate = await create.json();
    assert.equal(candidate.status, "candidate");
    assert.equal(candidate.occurrenceCount, 3);

    const repeated = await fetch(`${base}/aac-planning`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId: child.id, gestaltId: gestalt.id }),
    });
    assert.equal(repeated.status, 201);
    assert.equal((await repeated.json()).id, candidate.id);

    const update = await fetch(`${base}/aac-planning/${candidate.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "not_appropriate" }),
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).status, "not_appropriate");

    const gestaltsResponse = await fetch(`${base}/gestalts?childId=${child.id}`);
    assert.equal(gestaltsResponse.status, 200);
    assert.equal((await gestaltsResponse.json())[0].aacPlanningStatus, "not_appropriate");

    currentActor = { ...currentActor, role: "Teacher" };
    assert.equal((await fetch(`${base}/aac-planning?childId=${child.id}`)).status, 403);
    currentActor = { ...currentActor, role: "SLP" };

    const remove = await fetch(`${base}/aac-planning/${candidate.id}`, { method: "DELETE" });
    assert.equal(remove.status, 204);
    assert.equal((await db.select().from(clinicalGestaltsTable).where(eq(clinicalGestaltsTable.id, gestalt.id))).length, 1);
    assert.equal((await db.select().from(gestaltOccurrencesTable).where(eq(gestaltOccurrencesTable.gestaltId, gestalt.id)))[0]?.occurrenceCount, 3);
  } finally {
    server.close();
    await db.delete(aacVocabularyPlanningTable).where(eq(aacVocabularyPlanningTable.childId, child.id));
    await db.delete(gestaltOccurrencesTable).where(eq(gestaltOccurrencesTable.gestaltId, gestalt.id));
    await db.delete(clinicalGestaltsTable).where(eq(clinicalGestaltsTable.id, gestalt.id));
    await db.delete(childCareTeamMembershipsTable).where(eq(childCareTeamMembershipsTable.childId, child.id));
    await db.delete(childProfilesTable).where(eq(childProfilesTable.id, child.id));
    await db.delete(organizationMembershipsTable).where(eq(organizationMembershipsTable.organizationId, organization.id));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
  }
});