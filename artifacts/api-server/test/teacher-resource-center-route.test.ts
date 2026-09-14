import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  teacherResourceItemsTable,
  teacherResourcesTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("Teacher Resources is teacher-only and assigned-student scoped", async () => {
  const suffix = randomUUID();
  const userId = `teacher-resources-${suffix}`;
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `teacher-resources-${suffix}`,
      name: "Teacher resources test",
    })
    .returning();
  assert.ok(organization);
  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "teacher-resources-test",
    providerSubject: userId,
    displayName: "Resource Teacher",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "teacher",
  });
  const profiles = await db
    .insert(childProfilesTable)
    .values([
      {
        organizationId: organization.id,
        displayName: "Assigned Student",
        school: "ChildLed School",
        grade: "2",
      },
      {
        organizationId: organization.id,
        displayName: "Unassigned Student",
        school: "ChildLed School",
        grade: "3",
      },
    ])
    .returning();
  const assigned = profiles[0];
  const unassigned = profiles[1];
  assert.ok(assigned && unassigned);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: assigned.id,
    userId,
    role: "teacher",
  });

  let actor: ResolvedCareTeamActor = {
    userId,
    author: "Resource Teacher",
    role: "Teacher",
    childIds: [assigned.id],
    isAdmin: false,
    organizationId: organization.id,
    expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = actor;
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
    const unassignedResponse = await fetch(
      `${base}/teacher-resource-center?childId=${unassigned.id}`,
    );
    assert.equal(unassignedResponse.status, 403);

    const assignedResponse = await fetch(
      `${base}/teacher-resource-center?childId=${assigned.id}`,
    );
    assert.equal(assignedResponse.status, 200);
    const resources = await assignedResponse.json();
    assert.equal(resources.title, "Teacher Resources");
    assert.ok(resources.items.length >= 8);

    actor = { ...actor, role: "Parent" };
    const parentResponse = await fetch(
      `${base}/teacher-resource-center?childId=${assigned.id}`,
    );
    assert.equal(parentResponse.status, 403);
  } finally {
    server.close();
    const resourceRows = await db
      .select({ id: teacherResourcesTable.id })
      .from(teacherResourcesTable)
      .where(eq(teacherResourcesTable.organizationId, organization.id));
    if (resourceRows.length) {
      await db.delete(teacherResourceItemsTable).where(
        inArray(
          teacherResourceItemsTable.resourceId,
          resourceRows.map((resource) => resource.id),
        ),
      );
      await db
        .delete(teacherResourcesTable)
        .where(eq(teacherResourcesTable.organizationId, organization.id));
    }
    await db
      .delete(childCareTeamMembershipsTable)
      .where(eq(childCareTeamMembershipsTable.userId, userId));
    await db.delete(childProfilesTable).where(
      inArray(
        childProfilesTable.id,
        profiles.map((profile) => profile.id),
      ),
    );
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
  }
});
