import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  teamMessagesTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/echomap";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("teacher overview stays teacher-only and assigned-student scoped", async () => {
  const suffix = randomUUID();
  const userId = `teacher-overview-${suffix}`;
  const [organization] = await db.insert(organizationsTable).values({
    slug: `teacher-overview-${suffix}`,
    name: "Teacher overview test",
  }).returning();
  assert.ok(organization);
  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "teacher-overview-test",
    providerSubject: userId,
    displayName: "Test Teacher",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "teacher",
  });
  const profiles = await db.insert(childProfilesTable).values([
    { organizationId: organization.id, displayName: "Assigned Student", school: "Echo School", grade: "2" },
    { organizationId: organization.id, displayName: "Unassigned Student", school: "Echo School", grade: "3" },
  ]).returning();
  const assigned = profiles[0];
  const unassigned = profiles[1];
  assert.ok(assigned && unassigned);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: assigned.id,
    userId,
    role: "teacher",
  });
  await db.insert(teamMessagesTable).values([
    { organizationId: organization.id, childId: assigned.id, senderUserId: userId, senderRole: "Teacher", messageType: "question", body: "Assigned question" },
    { organizationId: organization.id, childId: unassigned.id, senderUserId: userId, senderRole: "Teacher", messageType: "question", body: "Unassigned question" },
  ]);
  await db.insert(clinicalGestaltsTable).values([
    { organizationId: organization.id, childId: assigned.id, phrase: "All done", normalizedPhrase: "all done", meaning: "Finished with the current activity", communicationFunction: "Protest", contexts: ["School"], emotionalState: "Regulated", source: "Clinician review", createdByUserId: userId },
    { organizationId: organization.id, childId: unassigned.id, phrase: "All done now", normalizedPhrase: "all done now", meaning: "Unassigned private meaning", communicationFunction: "Protest", contexts: ["School"], emotionalState: "Regulated", source: "Clinician review", createdByUserId: userId },
  ]);

  let actor: ResolvedCareTeamActor = {
    userId,
    author: "Test Teacher",
    role: "Teacher",
    childIds: [assigned.id],
    isAdmin: false,
    organizationId: organization.id,
    expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.echomapActor = actor;
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
    actor = { ...actor, role: "Parent" };
    assert.equal((await fetch(`${base}/teacher-overview`)).status, 403);
    actor = { ...actor, role: "Teacher" };
    const response = await fetch(`${base}/teacher-overview`);
    assert.equal(response.status, 200);
    const overview = await response.json();
    assert.equal(overview.activeChildren, 1);
    assert.equal(overview.newTeamMessages, 1);
    assert.equal(overview.studentsRequiringReview, 1);
    assert.deepEqual(overview.children.map((child: { childName: string }) => child.childName), ["Assigned Student"]);
    assert.equal(overview.recentActivity.length, 2);
    assert.ok(overview.recentActivity.every((item: { target: string }) => item.target === "Assigned Student"));
    const missingStudentLookup = await fetch(`${base}/teacher-phrase-lookup?query=all%20done`);
    assert.equal(missingStudentLookup.status, 400);
    const unassignedLookup = await fetch(`${base}/teacher-phrase-lookup?childId=${unassigned.id}&query=all%20done`);
    assert.equal(unassignedLookup.status, 403);
    const lookup = await fetch(`${base}/teacher-phrase-lookup?childId=${assigned.id}&query=all%20done`);
    assert.equal(lookup.status, 200);
    const lookupResults = await lookup.json();
    assert.deepEqual(lookupResults.map((result: { childName: string }) => result.childName), ["Assigned Student"]);
    assert.equal(lookupResults[0].meaning, "Finished with the current activity");
  } finally {
    server.close();
    await db.delete(clinicalGestaltsTable).where(eq(clinicalGestaltsTable.createdByUserId, userId));
    await db.delete(teamMessagesTable).where(eq(teamMessagesTable.senderUserId, userId));
    await db.delete(childCareTeamMembershipsTable).where(eq(childCareTeamMembershipsTable.userId, userId));
    await db.delete(childProfilesTable).where(inArray(childProfilesTable.id, profiles.map((profile) => profile.id)));
    await db.delete(organizationMembershipsTable).where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
  }
});