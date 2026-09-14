import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  teamConversationsTable,
  teamMessagesTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("an existing Teacher can be assigned to another authorized student exactly once", async () => {
  const suffix = randomUUID();
  const slpUserId = "teacher-assignment-slp-" + suffix;
  const teacherUserId = "teacher-assignment-teacher-" + suffix;
  const parentUserId = "teacher-assignment-parent-" + suffix;
  const teacherEmail = "teacher-" + suffix + "@example.test";
  const parentEmail = "parent-" + suffix + "@example.test";
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: "teacher-assignment-" + suffix,
      name: "Teacher Assignment Test",
      betaApprovedAt: new Date(),
    })
    .returning();
  assert.ok(organization);
  await db.insert(usersTable).values([
    {
      id: slpUserId,
      identityProvider: "teacher-assignment-test",
      providerSubject: slpUserId,
      displayName: "Test SLP",
      email: "slp-" + suffix + "@example.test",
    },
    {
      id: teacherUserId,
      identityProvider: "teacher-assignment-test",
      providerSubject: teacherUserId,
      displayName: "Sarah Jones",
      email: teacherEmail,
    },
    {
      id: parentUserId,
      identityProvider: "teacher-assignment-test",
      providerSubject: parentUserId,
      displayName: "Test Parent",
      email: parentEmail,
    },
  ]);
  await db.insert(organizationMembershipsTable).values([
    {
      organizationId: organization.id,
      userId: slpUserId,
      role: "clinician",
    },
    {
      organizationId: organization.id,
      userId: teacherUserId,
      role: "teacher",
    },
    {
      organizationId: organization.id,
      userId: parentUserId,
      role: "parent",
    },
  ]);
  const children = await db
    .insert(childProfilesTable)
    .values([
      { organizationId: organization.id, displayName: "Oliver Bennett" },
      { organizationId: organization.id, displayName: "Ava Johnson" },
      { organizationId: organization.id, displayName: "Noah Martinez" },
    ])
    .returning();
  const [oliver, ava, noah] = children;
  assert.ok(oliver && ava && noah);
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: oliver.id, userId: slpUserId, role: "clinician" },
    { childId: ava.id, userId: slpUserId, role: "clinician" },
    { childId: oliver.id, userId: teacherUserId, role: "teacher" },
  ]);

  let actor: ResolvedCareTeamActor = {
    userId: slpUserId,
    author: "Test SLP",
    role: "SLP",
    childIds: [oliver.id, ava.id],
    isAdmin: false,
    organizationId: organization.id,
    accountStatus: "active",
    onboardingComplete: true,
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
  const base = "http://127.0.0.1:" + address.port;
  const post = (path: string, data: unknown) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });

  try {
    const available = await post("/care-team-teachers/lookup", {
      childId: ava.id,
      email: teacherEmail.toUpperCase(),
    });
    assert.equal(available.status, 200);
    assert.deepEqual(await available.json(), {
      status: "available",
      teacher: { name: "Sarah Jones", role: "Teacher" },
    });

    const duplicate = await post("/care-team-teachers/lookup", {
      childId: oliver.id,
      email: teacherEmail,
    });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).status, "already_assigned");

    const wrongRole = await post("/care-team-teachers/lookup", {
      childId: ava.id,
      email: parentEmail,
    });
    assert.equal(wrongRole.status, 200);
    assert.deepEqual(await wrongRole.json(), { status: "different_role" });

    const missing = await post("/care-team-teachers/lookup", {
      childId: ava.id,
      email: "missing-" + suffix + "@example.test",
    });
    assert.equal(missing.status, 200);
    assert.deepEqual(await missing.json(), { status: "not_found" });

    const unauthorized = await post("/care-team-teachers/lookup", {
      childId: noah.id,
      email: teacherEmail,
    });
    assert.equal(unauthorized.status, 403);

    const assigned = await post("/care-team-teachers/assign", {
      childId: ava.id,
      email: teacherEmail,
    });
    assert.equal(assigned.status, 201);
    assert.deepEqual(await assigned.json(), {
      childId: ava.id,
      assigned: true,
      notificationCreated: true,
      teacher: { name: "Sarah Jones", role: "Teacher" },
    });

    const assignedAgain = await post("/care-team-teachers/assign", {
      childId: ava.id,
      email: teacherEmail,
    });
    assert.equal(assignedAgain.status, 409);
    const assignments = await db
      .select()
      .from(childCareTeamMembershipsTable)
      .where(
        and(
          eq(childCareTeamMembershipsTable.childId, ava.id),
          eq(childCareTeamMembershipsTable.userId, teacherUserId),
        ),
      );
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0]?.active, true);
    const assignmentMessages = await db
      .select()
      .from(teamMessagesTable)
      .where(
        and(
          eq(teamMessagesTable.organizationId, organization.id),
          eq(teamMessagesTable.childId, ava.id),
          eq(teamMessagesTable.senderUserId, slpUserId),
        ),
      );
    assert.equal(assignmentMessages.length, 1);
    assert.match(assignmentMessages[0]?.body ?? "", /New student added/);

    actor = {
      ...actor,
      userId: teacherUserId,
      author: "Sarah Jones",
      role: "Teacher",
      childIds: [oliver.id, ava.id],
    };
    const overview = await fetch(base + "/teacher-overview");
    assert.equal(overview.status, 200);
    const overviewBody = await overview.json();
    assert.deepEqual(
      overviewBody.children
        .map((child: { childName: string }) => child.childName)
        .sort(),
      ["Ava Johnson", "Oliver Bennett"],
    );
    assert.equal(overviewBody.newTeamMessages, 1);
    assert.equal(
      overviewBody.children.some(
        (child: { childName: string }) => child.childName === "Noah Martinez",
      ),
      false,
    );
    const inbox = await fetch(base + "/team-inbox");
    assert.equal(inbox.status, 200);
    const inboxBody = await inbox.json();
    const assignmentConversation = inboxBody.conversations.find(
      (conversation: { childId: number }) => conversation.childId === ava.id,
    );
    assert.ok(assignmentConversation);
    assert.equal(assignmentConversation.unreadCount, 1);
    assert.equal(inboxBody.totalUnread, 1);

    actor = { ...actor, role: "Parent" };
    const parentAttempt = await post("/care-team-teachers/assign", {
      childId: ava.id,
      email: teacherEmail,
    });
    assert.equal(parentAttempt.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, slpUserId));
    await db
      .delete(teamConversationsTable)
      .where(eq(teamConversationsTable.organizationId, organization.id));
    await db.delete(childCareTeamMembershipsTable).where(
      inArray(
        childCareTeamMembershipsTable.childId,
        children.map((child) => child.id),
      ),
    );
    await db.delete(childProfilesTable).where(
      inArray(
        childProfilesTable.id,
        children.map((child) => child.id),
      ),
    );
    await db
      .delete(organizationMembershipsTable)
      .where(
        inArray(organizationMembershipsTable.userId, [
          slpUserId,
          teacherUserId,
          parentUserId,
        ]),
      );
    await db
      .delete(usersTable)
      .where(inArray(usersTable.id, [slpUserId, teacherUserId, parentUserId]));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
  }
});
