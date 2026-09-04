import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  sharedChildProfileEntriesTable,
  sharedChildProfileHistoryTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/echomap";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("shared child profile is tenant-scoped, ownership-safe, conflict-safe, historical, and separate from clinical data", async () => {
  const suffix = randomUUID();
  const [organization, otherOrganization] = await db.insert(organizationsTable).values([
    { slug: `shared-profile-${suffix}`, name: "Shared profile test organization" },
    { slug: `shared-profile-other-${suffix}`, name: "Other shared profile organization" },
  ]).returning();
  assert.ok(organization && otherOrganization);

  const users = {
    clinician: `shared-profile-clinician-${suffix}`,
    parent: `shared-profile-parent-${suffix}`,
    teacher: `shared-profile-teacher-${suffix}`,
    outsider: `shared-profile-outsider-${suffix}`,
  };
  await db.insert(usersTable).values([
    { id: users.clinician, identityProvider: "shared-profile-test", providerSubject: users.clinician, displayName: "Profile Clinician" },
    { id: users.parent, identityProvider: "shared-profile-test", providerSubject: users.parent, displayName: "Profile Parent" },
    { id: users.teacher, identityProvider: "shared-profile-test", providerSubject: users.teacher, displayName: "Profile Teacher" },
    { id: users.outsider, identityProvider: "shared-profile-test", providerSubject: users.outsider, displayName: "Other Parent" },
  ]);
  await db.insert(organizationMembershipsTable).values([
    { organizationId: organization.id, userId: users.clinician, role: "clinician" },
    { organizationId: organization.id, userId: users.parent, role: "parent" },
    { organizationId: organization.id, userId: users.teacher, role: "teacher" },
    { organizationId: otherOrganization.id, userId: users.outsider, role: "parent" },
  ]);
  const [child] = await db.insert(childProfilesTable).values({
    organizationId: organization.id,
    displayName: "Shared Profile Child",
    school: "Cedar Grove",
    grade: "2nd",
    profileDetails: {
      glpNotes: "Clinical detail that must not enter the shared profile.",
      strengths: ["Strong memory"],
      specialInterests: ["Transit maps"],
      sensorySupports: ["Quiet corner"],
      sensoryChallenges: ["Fire drills"],
      regulationNotes: "A two-minute warning helps.",
    },
  }).returning();
  assert.ok(child);
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: child.id, userId: users.clinician, role: "clinician" },
    { childId: child.id, userId: users.parent, role: "parent" },
    { childId: child.id, userId: users.teacher, role: "teacher" },
  ]);
  const [gestalt] = await db.insert(clinicalGestaltsTable).values({
    organizationId: organization.id,
    childId: child.id,
    phrase: "Let's go",
    normalizedPhrase: "lets go",
    meaning: "Ready to transition",
    communicationFunction: "Transition",
    contexts: ["Therapy"],
    emotionalState: "Regulated",
    source: "Clinician review",
    createdByUserId: users.clinician,
  }).returning();
  assert.ok(gestalt);

  const actor = (userId: string, author: string, role: ResolvedCareTeamActor["role"], organizationId: number, childIds: number[]): ResolvedCareTeamActor => ({
    userId,
    author,
    role,
    organizationId,
    childIds,
    isAdmin: false,
    expiresAt: Date.now() + 60_000,
  });
  const actors: Record<string, ResolvedCareTeamActor> = {
    clinician: actor(users.clinician, "Profile Clinician", "SLP", organization.id, [child.id]),
    parent: actor(users.parent, "Profile Parent", "Parent", organization.id, [child.id]),
    formerParentAdmin: actor(users.parent, "Profile Parent", "Administrator", organization.id, [child.id]),
    teacher: actor(users.teacher, "Profile Teacher", "Teacher", organization.id, [child.id]),
    outsider: actor(users.outsider, "Other Parent", "Parent", otherOrganization.id, []),
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.echomapActor = actors[String(req.header("x-test-actor") ?? "")];
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, actorName: keyof typeof actors, init?: RequestInit) => fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-test-actor": actorName, ...init?.headers },
  });

  try {
    assert.equal((await request(`/child-shared-profile?childId=${child.id}`, "outsider")).status, 403);

    const initialResponse = await request(`/child-shared-profile?childId=${child.id}`, "parent");
    assert.equal(initialResponse.status, 200);
    const initial = await initialResponse.json() as any;
    assert.equal(initial.sections.length, 4);
    assert.equal(initial.sections.find((section: any) => section.section === "strengths").entries[0].value, "Strong memory");
    assert.equal(initial.sections.find((section: any) => section.section === "sensory_supports").entries.length, 2);
    assert.equal(JSON.stringify(initial).includes("Clinical detail that must not enter"), false);
    assert.ok(initial.history.length >= 5);

    const [parentCreate, teacherCreate] = await Promise.all([
      request(`/child-shared-profile?childId=${child.id}`, "parent", {
        method: "POST",
        body: JSON.stringify({ section: "strengths", value: "Patient problem solver" }),
      }),
      request(`/child-shared-profile?childId=${child.id}`, "teacher", {
        method: "POST",
        body: JSON.stringify({ section: "interests", value: "Weather maps" }),
      }),
    ]);
    assert.equal(parentCreate.status, 201);
    assert.equal(teacherCreate.status, 201);
    const parentEntry = await parentCreate.json() as any;
    const teacherEntry = await teacherCreate.json() as any;
    assert.equal(parentEntry.authorRole, "Parent");
    assert.equal(teacherEntry.authorRole, "Teacher");
    assert.equal((await request(`/child-shared-profile/entries/${parentEntry.id}`, "formerParentAdmin", {
      method: "PATCH",
      body: JSON.stringify({ value: "Former contributor overwrite", version: parentEntry.version }),
    })).status, 403);
    assert.equal((await request(`/child-shared-profile/entries/${parentEntry.id}/versions/${parentEntry.version}`, "formerParentAdmin", {
      method: "DELETE",
    })).status, 403);
    assert.equal((await request(`/child-shared-profile/entries/${parentEntry.id}`, "teacher", {
      method: "PATCH",
      body: JSON.stringify({ value: "Teacher overwrite", version: parentEntry.version }),
    })).status, 403);

    const updatedResponse = await request(`/child-shared-profile/entries/${parentEntry.id}`, "parent", {
      method: "PATCH",
      body: JSON.stringify({ value: "Patient and persistent problem solver", version: parentEntry.version }),
    });
    assert.equal(updatedResponse.status, 200);
    const updated = await updatedResponse.json() as any;
    assert.equal(updated.version, parentEntry.version + 1);
    assert.equal((await request(`/child-shared-profile/entries/${parentEntry.id}`, "parent", {
      method: "PATCH",
      body: JSON.stringify({ value: "Stale overwrite", version: parentEntry.version }),
    })).status, 409);
    assert.equal((await request(`/child-shared-profile/entries/${parentEntry.id}/versions/${parentEntry.version}`, "parent", {
      method: "DELETE",
    })).status, 409);

    const raceCreateResponse = await request(`/child-shared-profile?childId=${child.id}`, "parent", {
      method: "POST",
      body: JSON.stringify({ section: "regulation_notes", value: "Original concurrent note" }),
    });
    assert.equal(raceCreateResponse.status, 201);
    const raceEntry = await raceCreateResponse.json() as any;
    const raceResponses = await Promise.all([
      request(`/child-shared-profile/entries/${raceEntry.id}`, "parent", {
        method: "PATCH",
        body: JSON.stringify({ value: "Concurrent note A", version: raceEntry.version }),
      }),
      request(`/child-shared-profile/entries/${raceEntry.id}`, "parent", {
        method: "PATCH",
        body: JSON.stringify({ value: "Concurrent note B", version: raceEntry.version }),
      }),
    ]);
    assert.deepEqual(raceResponses.map((response) => response.status).sort(), [200, 409]);
    const [raceStored] = await db.select().from(sharedChildProfileEntriesTable).where(eq(sharedChildProfileEntriesTable.id, raceEntry.id));
    assert.equal(raceStored?.version, raceEntry.version + 1);
    assert.ok(["Concurrent note A", "Concurrent note B"].includes(raceStored?.value ?? ""));
    const raceHistory = await db.select().from(sharedChildProfileHistoryTable).where(eq(sharedChildProfileHistoryTable.entryId, raceEntry.id));
    assert.equal(raceHistory.filter((event) => event.action === "updated").length, 1);
    assert.equal(raceHistory.find((event) => event.action === "updated")?.previousValue, "Original concurrent note");

    const sharedResponse = await request(`/child-shared-profile?childId=${child.id}`, "clinician");
    const shared = await sharedResponse.json() as any;
    const strengthValues = shared.sections.find((section: any) => section.section === "strengths").entries.map((entry: any) => entry.value);
    const interestValues = shared.sections.find((section: any) => section.section === "interests").entries.map((entry: any) => entry.value);
    assert.deepEqual(new Set(strengthValues), new Set(["Strong memory", "Patient and persistent problem solver"]));
    assert.ok(interestValues.includes("Transit maps"));
    assert.ok(interestValues.includes("Weather maps"));
    assert.match(shared.sections.find((section: any) => section.section === "strengths").lastUpdatedBy, /Profile Parent/);
    assert.ok(shared.history.some((event: any) => event.action === "updated" && event.previousValue === "Patient problem solver"));

    assert.equal((await request(`/child-shared-profile/entries/${parentEntry.id}/versions/${updated.version}`, "parent", {
      method: "DELETE",
    })).status, 204);
    const finalHistory = await db.select().from(sharedChildProfileHistoryTable).where(eq(sharedChildProfileHistoryTable.entryId, parentEntry.id));
    assert.deepEqual(finalHistory.map((event) => event.action).sort(), ["created", "deleted", "updated"]);
    const [clinicalRecord] = await db.select().from(clinicalGestaltsTable).where(eq(clinicalGestaltsTable.id, gestalt.id));
    assert.equal(clinicalRecord?.meaning, "Ready to transition");
    const audit = await db.select().from(securityAuditLogsTable).where(and(
      eq(securityAuditLogsTable.userId, users.parent),
      eq(securityAuditLogsTable.childId, child.id),
    ));
    assert.ok(audit.some((event) => event.action === "SHARED_CHILD_PROFILE_ENTRY_CREATED"));
    assert.ok(audit.some((event) => event.action === "SHARED_CHILD_PROFILE_ENTRY_UPDATED"));
    assert.ok(audit.some((event) => event.action === "SHARED_CHILD_PROFILE_ENTRY_REMOVED"));
  } finally {
    server.close();
    await db.delete(securityAuditLogsTable).where(eq(securityAuditLogsTable.childId, child.id));
    await db.delete(sharedChildProfileHistoryTable).where(eq(sharedChildProfileHistoryTable.childId, child.id));
    await db.delete(sharedChildProfileEntriesTable).where(eq(sharedChildProfileEntriesTable.childId, child.id));
    await db.delete(clinicalGestaltsTable).where(eq(clinicalGestaltsTable.id, gestalt.id));
    await db.delete(childCareTeamMembershipsTable).where(eq(childCareTeamMembershipsTable.childId, child.id));
    await db.delete(childProfilesTable).where(eq(childProfilesTable.id, child.id));
    await db.delete(organizationMembershipsTable).where(eq(organizationMembershipsTable.organizationId, organization.id));
    await db.delete(organizationMembershipsTable).where(eq(organizationMembershipsTable.organizationId, otherOrganization.id));
    await db.delete(usersTable).where(eq(usersTable.id, users.clinician));
    await db.delete(usersTable).where(eq(usersTable.id, users.parent));
    await db.delete(usersTable).where(eq(usersTable.id, users.teacher));
    await db.delete(usersTable).where(eq(usersTable.id, users.outsider));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, otherOrganization.id));
  }
});