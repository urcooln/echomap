import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  teamMessagesTable,
  teamMessageReadsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

const makeActor = (
  userId: string,
  organizationId: number,
  childIds: number[],
): ResolvedCareTeamActor => ({
  userId,
  author: "Assigned Administrator",
  role: "Administrator",
  childIds,
  isAdmin: true,
  organizationId,
  expiresAt: Date.now() + 60_000,
});

test.after(async () => {
  await pool.end();
});

test("team inbox only exposes and mutates messages for assigned children", async () => {
  const suffix = randomUUID();
  const userIds = {
    administrator: `team-inbox-admin-${suffix}`,
    sender: `team-inbox-sender-${suffix}`,
  };
  const created = {
    organizationId: undefined as number | undefined,
    childIds: [] as number[],
    messageIds: [] as number[],
  };

  const [organization] = await db
    .insert(organizationsTable)
    .values({ slug: `team-inbox-${suffix}`, name: "Team inbox route test organization" })
    .returning({ id: organizationsTable.id });
  assert.ok(organization);
  created.organizationId = organization.id;

  await db.insert(usersTable).values([
    {
      id: userIds.administrator,
      identityProvider: "team-inbox-test",
      providerSubject: userIds.administrator,
      displayName: "Assigned Administrator",
    },
    {
      id: userIds.sender,
      identityProvider: "team-inbox-test",
      providerSubject: userIds.sender,
      displayName: "Team Message Sender",
    },
  ]);
  await db.insert(organizationMembershipsTable).values([
    { organizationId: organization.id, userId: userIds.administrator, role: "admin" },
    { organizationId: organization.id, userId: userIds.sender, role: "clinician" },
  ]);

  const children = await db
    .insert(childProfilesTable)
    .values([
      { organizationId: organization.id, displayName: "Assigned Child" },
      { organizationId: organization.id, displayName: "Second Assigned Child" },
      { organizationId: organization.id, displayName: "Unassigned Child" },
    ])
    .returning({ id: childProfilesTable.id });
  assert.equal(children.length, 3);
  const assignedChild = children[0];
  const secondAssignedChild = children[1];
  const unassignedChild = children[2];
  assert.ok(assignedChild);
  assert.ok(secondAssignedChild);
  assert.ok(unassignedChild);
  created.childIds.push(assignedChild.id, secondAssignedChild.id, unassignedChild.id);

  await db.insert(childCareTeamMembershipsTable).values([
    {
      childId: assignedChild.id,
      userId: userIds.administrator,
      role: "admin",
    },
    {
      childId: secondAssignedChild.id,
      userId: userIds.administrator,
      role: "admin",
    },
  ]);

  const messages = await db
    .insert(teamMessagesTable)
    .values([
      {
        organizationId: organization.id,
        childId: assignedChild.id,
        senderUserId: userIds.sender,
        senderRole: "SLP",
        messageType: "question",
        audience: "entire_team",
        body: "AUTHORIZED_ASSIGNED_CHILD_MESSAGE",
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
      },
      {
        organizationId: organization.id,
        childId: assignedChild.id,
        senderUserId: userIds.sender,
        senderRole: "Parent",
        messageType: "message",
        audience: "entire_team",
        body: "AUTHORIZED_PARENT_MESSAGE",
        createdAt: new Date("2026-08-25T10:30:00.000Z"),
      },
      {
        organizationId: organization.id,
        childId: assignedChild.id,
        senderUserId: userIds.sender,
        senderRole: "Administrator",
        messageType: "notification",
        audience: "entire_team",
        body: "AUTHORIZED_ADMINISTRATOR_MESSAGE",
        createdAt: new Date("2026-08-25T10:45:00.000Z"),
      },
      {
        organizationId: organization.id,
        childId: secondAssignedChild.id,
        senderUserId: userIds.sender,
        senderRole: "SLP",
        messageType: "update",
        audience: "entire_team",
        body: "AUTHORIZED_SECOND_CHILD_MESSAGE",
        createdAt: new Date("2026-08-25T11:15:00.000Z"),
      },
      {
        organizationId: organization.id,
        childId: unassignedChild.id,
        senderUserId: userIds.sender,
        senderRole: "SLP",
        messageType: "notification",
        audience: "entire_team",
        body: "UNAUTHORIZED_UNASSIGNED_CHILD_MESSAGE",
        createdAt: new Date("2026-08-25T11:00:00.000Z"),
      },
    ])
    .returning({ id: teamMessagesTable.id });
  assert.equal(messages.length, 5);
  const assignedMessage = messages[0];
  const parentMessage = messages[1];
  const administratorMessage = messages[2];
  const secondChildMessage = messages[3];
  const unassignedMessage = messages[4];
  assert.ok(assignedMessage);
  assert.ok(parentMessage);
  assert.ok(administratorMessage);
  assert.ok(secondChildMessage);
  assert.ok(unassignedMessage);
  created.messageIds.push(assignedMessage.id, parentMessage.id, administratorMessage.id, secondChildMessage.id, unassignedMessage.id);

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
  const actor = makeActor(userIds.administrator, organization.id, [assignedChild.id, secondAssignedChild.id]);
  await db.insert(teamMessageReadsTable).values({
    messageId: administratorMessage.id,
    userId: userIds.administrator,
  });

  const request = async (path: string, init?: RequestInit) => {
    currentActor = actor;
    const response = await fetch(`${baseUrl}${path}`, init);
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  };
  const jsonRequest = (path: string, body: Record<string, unknown>) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    const globalInbox = await request("/team-inbox");
    assert.equal(globalInbox.status, 200);
    assert.deepEqual(globalInbox.body.children.map((child: { childId: number }) => child.childId), [assignedChild.id, secondAssignedChild.id]);
    assert.deepEqual(
      globalInbox.body.messages.map((message: { id: number }) => message.id),
      [secondChildMessage.id, parentMessage.id, assignedMessage.id, administratorMessage.id],
    );
    assert.equal(globalInbox.body.children[0].messageCount, 3);
    assert.equal(globalInbox.body.children[1].messageCount, 1);
    assert.equal(globalInbox.body.totalUnread, 3);
    assert.match(JSON.stringify(globalInbox.body), /AUTHORIZED_ASSIGNED_CHILD_MESSAGE/);
    assert.match(JSON.stringify(globalInbox.body), /AUTHORIZED_PARENT_MESSAGE/);
    assert.match(JSON.stringify(globalInbox.body), /AUTHORIZED_ADMINISTRATOR_MESSAGE/);
    assert.equal(globalInbox.body.messages[0].childName, "Second Assigned Child");
    assert.equal(JSON.stringify(globalInbox.body).includes("UNAUTHORIZED_UNASSIGNED_CHILD_MESSAGE"), false);
    assert.match(JSON.stringify(globalInbox.body), /AUTHORIZED_SECOND_CHILD_MESSAGE/);

    const authorizedSearch = await request("/team-inbox?search=AUTHORIZED_ASSIGNED_CHILD_MESSAGE");
    assert.equal(authorizedSearch.status, 200);
    assert.deepEqual(
      authorizedSearch.body.messages.map((message: { id: number }) => message.id),
      [assignedMessage.id],
    );

    const roleFilteredInbox = await request("/team-inbox?senderRole=Parent");
    assert.equal(roleFilteredInbox.status, 200);
    assert.deepEqual(
      roleFilteredInbox.body.messages.map((message: { id: number }) => message.id),
      [parentMessage.id],
    );
    assert.equal(roleFilteredInbox.body.messages[0].senderRole, "Parent");
    assert.equal(roleFilteredInbox.body.children[0].messageCount, 1);

    const slpRoleFilteredInbox = await request("/team-inbox?senderRole=SLP");
    assert.equal(slpRoleFilteredInbox.status, 200);
    assert.deepEqual(
      slpRoleFilteredInbox.body.messages.map((message: { id: number }) => message.id),
      [secondChildMessage.id, assignedMessage.id],
    );
    assert.equal(slpRoleFilteredInbox.body.messages[0].senderRole, "SLP");

    const administratorRoleFilteredInbox = await request("/team-inbox?senderRole=Administrator");
    assert.equal(administratorRoleFilteredInbox.status, 200);
    assert.deepEqual(
      administratorRoleFilteredInbox.body.messages.map((message: { id: number }) => message.id),
      [administratorMessage.id],
    );
    assert.equal(administratorRoleFilteredInbox.body.messages[0].senderRole, "Administrator");

    const invalidRoleFilter = await request("/team-inbox?senderRole=Unknown");
    assert.equal(invalidRoleFilter.status, 400);

    const unauthorizedSearch = await request("/team-inbox?search=UNAUTHORIZED_UNASSIGNED_CHILD_MESSAGE");
    assert.equal(unauthorizedSearch.status, 200);
    assert.deepEqual(unauthorizedSearch.body.children.map((child: { childId: number }) => child.childId), [assignedChild.id, secondAssignedChild.id]);
    assert.deepEqual(unauthorizedSearch.body.messages, []);
    assert.equal(JSON.stringify(unauthorizedSearch.body).includes("UNAUTHORIZED_UNASSIGNED_CHILD_MESSAGE"), false);

    const focusedAuthorized = await request(`/team-inbox?childId=${assignedChild.id}`);
    assert.equal(focusedAuthorized.status, 200);
    assert.equal(focusedAuthorized.body.childId, assignedChild.id);
    assert.deepEqual(
      focusedAuthorized.body.messages.map((message: { id: number }) => message.id),
      [parentMessage.id, assignedMessage.id, administratorMessage.id],
    );

    const focusedUnauthorized = await request(`/team-inbox?childId=${unassignedChild.id}`);
    assert.equal(focusedUnauthorized.status, 403);
    assert.equal(focusedUnauthorized.body.error, "This care-team role does not have access to this child.");

    const focusedUnauthorizedSearch = await request(
      `/team-inbox?childId=${unassignedChild.id}&search=UNAUTHORIZED_UNASSIGNED_CHILD_MESSAGE`,
    );
    assert.equal(focusedUnauthorizedSearch.status, 403);

    const unauthorizedCreate = await jsonRequest("/team-inbox", {
      childId: unassignedChild.id,
      body: "SHOULD_NOT_BE_CREATED",
    });
    assert.equal(unauthorizedCreate.status, 403);
    assert.equal(unauthorizedCreate.body.error, "This care-team role does not have access to this child.");

    const authorizedCreate = await jsonRequest("/team-inbox", {
      childId: assignedChild.id,
      body: "AUTHORIZED_CREATED_MESSAGE",
      messageType: "question",
    });
    assert.equal(authorizedCreate.status, 201);
    assert.equal(authorizedCreate.body.childId, assignedChild.id);
    assert.equal(authorizedCreate.body.childName, "Assigned Child");
    assert.equal(authorizedCreate.body.body, "AUTHORIZED_CREATED_MESSAGE");
    created.messageIds.push(authorizedCreate.body.id);

    const unauthorizedRead = await jsonRequest("/team-inbox/read", {
      messageIds: [assignedMessage.id, unassignedMessage.id],
    });
    assert.equal(unauthorizedRead.status, 403);
    assert.equal(unauthorizedRead.body.error, "You do not have access to one or more team messages.");

    const readsAfterMixedRequest = await db
      .select()
      .from(teamMessageReadsTable)
      .where(and(
        eq(teamMessageReadsTable.userId, userIds.administrator),
        inArray(teamMessageReadsTable.messageId, [assignedMessage.id, unassignedMessage.id]),
      ));
    assert.deepEqual(readsAfterMixedRequest, []);

    const authorizedRead = await jsonRequest("/team-inbox/read", {
      messageIds: [assignedMessage.id],
    });
    assert.deepEqual(authorizedRead, { status: 200, body: { updated: 1 } });

    const storedRead = await db
      .select()
      .from(teamMessageReadsTable)
      .where(and(
        eq(teamMessageReadsTable.messageId, assignedMessage.id),
        eq(teamMessageReadsTable.userId, userIds.administrator),
      ));
    assert.equal(storedRead.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (created.messageIds.length) {
      await db.delete(teamMessagesTable)
        .where(inArray(teamMessagesTable.id, created.messageIds));
    }
    if (created.childIds.length) {
      await db.delete(childCareTeamMembershipsTable)
        .where(inArray(childCareTeamMembershipsTable.childId, created.childIds));
      await db.delete(childProfilesTable)
        .where(inArray(childProfilesTable.id, created.childIds));
    }
    await db.delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, userIds.administrator));
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