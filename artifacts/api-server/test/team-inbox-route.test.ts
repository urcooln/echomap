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
  teamConversationsTable,
  teamMessagesTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import router from "../src/routes/childled";
import type {
  CareTeamRole,
  ResolvedCareTeamActor,
} from "../src/lib/auth-context";

const makeActor = (
  userId: string,
  author: string,
  role: CareTeamRole,
  organizationId: number,
  childIds: number[],
): ResolvedCareTeamActor => ({
  userId,
  author,
  role,
  childIds,
  isAdmin: role === "Administrator",
  organizationId,
  expiresAt: Date.now() + 60_000,
});

test.after(async () => {
  await pool.end();
});

test("team Inbox uses authorized child conversations and per-user unread state", async () => {
  const suffix = randomUUID();
  const ids = {
    slp: `inbox-slp-${suffix}`,
    parent: `inbox-parent-${suffix}`,
    secondParent: `inbox-parent-two-${suffix}`,
    teacher: `inbox-teacher-${suffix}`,
    outsider: `inbox-outsider-${suffix}`,
    emptySlp: `inbox-empty-slp-${suffix}`,
    inactiveTeacher: `inbox-inactive-teacher-${suffix}`,
  };
  const [organization] = await db
    .insert(organizationsTable)
    .values({ slug: `inbox-${suffix}`, name: "Inbox conversation test" })
    .returning({ id: organizationsTable.id });
  assert.ok(organization);

  await db.insert(usersTable).values([
    [ids.slp, "Jamie Carter"],
    [ids.parent, "Maria Bennett"],
    [ids.secondParent, "Alex Bennett"],
    [ids.teacher, "Taylor Rivera"],
    [ids.outsider, "Other Parent"],
    [ids.emptySlp, "Empty SLP"],
    [ids.inactiveTeacher, "Inactive Teacher"],
  ].map(([id, displayName]) => ({
    id,
    identityProvider: "team-inbox-test",
    providerSubject: id,
    displayName,
  })));
  await db.insert(organizationMembershipsTable).values([
    { organizationId: organization.id, userId: ids.slp, role: "clinician" },
    { organizationId: organization.id, userId: ids.parent, role: "parent" },
    { organizationId: organization.id, userId: ids.secondParent, role: "parent" },
    { organizationId: organization.id, userId: ids.teacher, role: "teacher" },
    { organizationId: organization.id, userId: ids.outsider, role: "parent" },
    { organizationId: organization.id, userId: ids.emptySlp, role: "clinician" },
    {
      organizationId: organization.id,
      userId: ids.inactiveTeacher,
      role: "teacher",
      active: false,
    },
  ]);
  const children = await db
    .insert(childProfilesTable)
    .values([
      { organizationId: organization.id, displayName: "Oliver Bennett" },
      { organizationId: organization.id, displayName: "Other Student" },
    ])
    .returning({ id: childProfilesTable.id });
  const child = children[0];
  const otherChild = children[1];
  assert.ok(child && otherChild);
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: child.id, userId: ids.slp, role: "clinician" },
    { childId: child.id, userId: ids.parent, role: "parent" },
    { childId: child.id, userId: ids.secondParent, role: "parent" },
    { childId: child.id, userId: ids.teacher, role: "teacher" },
    { childId: child.id, userId: ids.inactiveTeacher, role: "teacher" },
    { childId: otherChild.id, userId: ids.slp, role: "clinician" },
    { childId: otherChild.id, userId: ids.outsider, role: "parent" },
  ]);

  const actors = {
    slp: makeActor(ids.slp, "Jamie Carter", "SLP", organization.id, [child.id, otherChild.id]),
    parent: makeActor(ids.parent, "Maria Bennett", "Parent", organization.id, [child.id]),
    secondParent: makeActor(ids.secondParent, "Alex Bennett", "Parent", organization.id, [child.id]),
    teacher: makeActor(ids.teacher, "Taylor Rivera", "Teacher", organization.id, [child.id]),
    outsider: makeActor(ids.outsider, "Other Parent", "Parent", organization.id, [otherChild.id]),
    emptySlp: makeActor(ids.emptySlp, "Empty SLP", "SLP", organization.id, []),
  };

  let currentActor: ResolvedCareTeamActor | undefined;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = currentActor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = async (
    actor: ResolvedCareTeamActor,
    path: string,
    init?: RequestInit,
  ) => {
    currentActor = actor;
    const response = await fetch(`${baseUrl}${path}`, init);
    return {
      status: response.status,
      body: (await response.json()) as Record<string, any>,
    };
  };
  const post = (
    actor: ResolvedCareTeamActor,
    path: string,
    body: Record<string, unknown>,
  ) => request(actor, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  try {
    const first = await post(actors.parent, "/team-inbox", {
      childId: child.id,
      recipientUserIds: [ids.slp],
      messageType: "question",
      body: "How did Oliver do during speech today?",
    });
    assert.equal(first.status, 201);
    assert.ok(first.body.conversationId);
    const parentConversationId = first.body.conversationId as number;

    const parentInbox = await request(actors.parent, "/team-inbox");
    assert.equal(parentInbox.status, 200);
    assert.equal(parentInbox.body.totalUnread, 0);
    assert.equal(parentInbox.body.conversations.length, 1);
    assert.equal(parentInbox.body.messages[0].read, true);
    assert.equal(parentInbox.body.messages[0].body, "How did Oliver do during speech today?");

    const teacherBeforeMessage = await request(actors.teacher, "/team-inbox");
    assert.equal(teacherBeforeMessage.status, 200);
    assert.deepEqual(teacherBeforeMessage.body.conversations, []);

    const reused = await post(actors.parent, "/team-inbox", {
      childId: child.id,
      recipientUserIds: [ids.slp],
      body: "He mentioned his AAC device after school.",
    });
    assert.equal(reused.status, 201);
    assert.equal(reused.body.conversationId, parentConversationId);

    const secondParent = await post(actors.secondParent, "/team-inbox", {
      childId: child.id,
      recipientUserIds: [ids.slp],
      body: "I have a question about home practice.",
    });
    assert.equal(secondParent.status, 201);
    assert.notEqual(secondParent.body.conversationId, parentConversationId);

    const teacher = await post(actors.teacher, "/team-inbox", {
      childId: child.id,
      recipientUserIds: [ids.slp],
      body: "Oliver used the classroom board independently.",
    });
    assert.equal(teacher.status, 201);
    assert.equal(teacher.body.senderUserId, ids.teacher);
    assert.equal(teacher.body.senderName, "Taylor Rivera");
    assert.notEqual(teacher.body.conversationId, parentConversationId);

    await db.insert(teamMessagesTable).values({
      organizationId: organization.id,
      childId: child.id,
      senderUserId: ids.parent,
      recipientUserId: ids.slp,
      senderRole: "parent",
      messageType: "notification",
      audience: "entire_team",
      body: "This notification must not appear as conversation text.",
    });

    const slpInbox = await request(actors.slp, "/team-inbox");
    assert.equal(slpInbox.status, 200);
    assert.equal(slpInbox.body.totalUnread, 3);
    assert.equal(slpInbox.body.conversations.length, 3);
    assert.equal(slpInbox.body.messages.length, 4);
    assert.equal(JSON.stringify(slpInbox.body).includes("notification must not appear"), false);
    assert.equal(slpInbox.body.conversations[0].childName, "Oliver Bennett");
    assert.equal(
      slpInbox.body.members.some(
        (member: Record<string, any>) => member.userId === ids.inactiveTeacher,
      ),
      false,
    );

    const selectedThread = await request(
      actors.slp,
      `/team-inbox?childId=${child.id}&conversationId=${parentConversationId}`,
    );
    assert.equal(selectedThread.status, 200);
    assert.ok(
      selectedThread.body.conversations.some(
        (conversation: Record<string, any>) =>
          conversation.id === parentConversationId,
      ),
    );
    assert.equal(
      selectedThread.body.messages.filter(
        (message: Record<string, any>) =>
          message.conversationId === parentConversationId,
      ).length,
      2,
    );

    const inactiveRecipient = await post(actors.slp, "/team-inbox", {
      childId: child.id,
      recipientUserIds: [ids.inactiveTeacher],
      body: "This inactive workspace member must be denied.",
    });
    assert.equal(inactiveRecipient.status, 403);

    const search = await request(
      actors.slp,
      "/team-inbox?search=classroom%20board",
    );
    assert.equal(search.status, 200);
    assert.equal(search.body.conversations.length, 1);
    assert.equal(search.body.conversations[0].id, teacher.body.conversationId);

    const participantSearch = await request(
      actors.slp,
      "/team-inbox?search=Maria%20Bennett",
    );
    assert.equal(participantSearch.status, 200);
    assert.equal(participantSearch.body.conversations.length, 1);
    assert.equal(
      participantSearch.body.conversations[0].id,
      parentConversationId,
    );

    const overview = await request(
      actors.slp,
      "/clinician-overview?since=2026-01-01T00%3A00%3A00.000Z",
    );
    assert.equal(overview.status, 200);
    const messageUpdate = overview.body.changesByChild
      .flatMap((group: Record<string, any>) => group.changes)
      .find((change: Record<string, any>) => change.id === `message-${first.body.id}`);
    assert.ok(messageUpdate);
    assert.equal(
      messageUpdate.href,
      `/team-communication?childId=${child.id}&conversationId=${parentConversationId}`,
    );

    const parentThreadMessages = slpInbox.body.messages
      .filter((message: Record<string, any>) => message.conversationId === parentConversationId)
      .map((message: Record<string, any>) => message.id as number);
    assert.equal(parentThreadMessages.length, 2);
    const marked = await post(actors.slp, "/team-inbox/read", {
      messageIds: parentThreadMessages,
    });
    assert.deepEqual(marked, { status: 200, body: { updated: 2 } });
    const afterRead = await request(actors.slp, "/team-inbox");
    assert.equal(afterRead.body.totalUnread, 2);
    assert.equal(
      afterRead.body.conversations.find(
        (conversation: Record<string, any>) => conversation.id === parentConversationId,
      ).unreadCount,
      0,
    );

    const reply = await post(actors.slp, "/team-inbox", {
      childId: child.id,
      conversationId: parentConversationId,
      body: "Oliver participated well and used his device twice.",
    });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.senderUserId, ids.slp);
    assert.equal(reply.body.conversationId, parentConversationId);
    const parentAfterReply = await request(actors.parent, "/team-inbox");
    assert.equal(parentAfterReply.body.totalUnread, 1);
    assert.equal(parentAfterReply.body.conversations.length, 1);
    assert.equal(parentAfterReply.body.messages.length, 3);
    assert.equal(parentAfterReply.body.messages.at(-1).body, reply.body.body);
    assert.equal(parentAfterReply.body.messages.at(-1).senderUserId, ids.slp);
    assert.notEqual(
      parentAfterReply.body.messages.at(-1).senderUserId,
      parentAfterReply.body.currentUserId,
    );

    const teacherReply = await post(actors.slp, "/team-inbox", {
      childId: child.id,
      conversationId: teacher.body.conversationId,
      body: "Thank you for the classroom update.",
    });
    assert.equal(teacherReply.status, 201);
    const teacherAfterReply = await request(actors.teacher, "/team-inbox");
    assert.equal(teacherAfterReply.body.currentUserId, ids.teacher);
    assert.equal(teacherAfterReply.body.totalUnread, 1);
    assert.equal(teacherAfterReply.body.messages.at(-1).senderUserId, ids.slp);
    assert.notEqual(
      teacherAfterReply.body.messages.at(-1).senderUserId,
      teacherAfterReply.body.currentUserId,
    );

    const crossChildRecipient = await post(actors.parent, "/team-inbox", {
      childId: child.id,
      recipientUserIds: [ids.outsider],
      body: "This must be denied.",
    });
    assert.equal(crossChildRecipient.status, 403);

    const unrelatedChild = await post(actors.parent, "/team-inbox", {
      childId: otherChild.id,
      recipientUserIds: [ids.slp],
      body: "This child is not assigned to the parent.",
    });
    assert.equal(unrelatedChild.status, 403);

    const forgedConversation = await request(
      actors.parent,
      `/team-inbox?childId=${child.id}&conversationId=${teacher.body.conversationId}`,
    );
    assert.equal(forgedConversation.status, 403);
    const forgedReply = await post(actors.parent, "/team-inbox", {
      childId: child.id,
      conversationId: teacher.body.conversationId,
      body: "This reply must be denied.",
    });
    assert.equal(forgedReply.status, 403);

    const slpToParent = await post(actors.slp, "/team-inbox", {
      childId: otherChild.id,
      recipientUserIds: [ids.outsider],
      body: "SLP TO PARENT TEST",
    });
    assert.equal(slpToParent.status, 201);
    assert.equal(slpToParent.body.senderUserId, ids.slp);
    assert.ok(slpToParent.body.conversationId);

    const recipientInbox = await request(actors.outsider, "/team-inbox");
    assert.equal(recipientInbox.status, 200);
    assert.equal(recipientInbox.body.currentUserId, ids.outsider);
    assert.equal(recipientInbox.body.conversations.length, 1);
    assert.equal(recipientInbox.body.totalUnread, 1);
    assert.equal(recipientInbox.body.messages.at(-1).body, "SLP TO PARENT TEST");
    assert.equal(recipientInbox.body.messages.at(-1).senderUserId, ids.slp);

    const parentToSlp = await post(actors.outsider, "/team-inbox", {
      childId: otherChild.id,
      recipientUserIds: [ids.slp],
      messageType: "question",
      body: "PARENT TO SLP TEST",
    });
    assert.equal(parentToSlp.status, 201);
    assert.equal(parentToSlp.body.senderUserId, ids.outsider);
    assert.equal(
      parentToSlp.body.conversationId,
      slpToParent.body.conversationId,
    );

    const sharedParentThread = await request(
      actors.slp,
      `/team-inbox?childId=${otherChild.id}&conversationId=${slpToParent.body.conversationId}`,
    );
    assert.equal(sharedParentThread.status, 200);
    assert.deepEqual(
      sharedParentThread.body.messages.map(
        (message: Record<string, any>) => message.body,
      ),
      ["SLP TO PARENT TEST", "PARENT TO SLP TEST"],
    );
    assert.equal(
      sharedParentThread.body.messages.at(-1).senderUserId,
      ids.outsider,
    );

    const emptyInbox = await request(actors.emptySlp, "/team-inbox");
    assert.equal(emptyInbox.status, 200);
    assert.deepEqual(emptyInbox.body.conversations, []);
    assert.deepEqual(emptyInbox.body.messages, []);
    assert.equal(emptyInbox.body.totalUnread, 0);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await db.delete(securityAuditLogsTable).where(
      inArray(securityAuditLogsTable.userId, Object.values(ids)),
    );
    await db.delete(teamMessagesTable).where(
      eq(teamMessagesTable.organizationId, organization.id),
    );
    await db.delete(teamConversationsTable).where(
      eq(teamConversationsTable.organizationId, organization.id),
    );
    await db.delete(childCareTeamMembershipsTable).where(
      inArray(childCareTeamMembershipsTable.childId, [child.id, otherChild.id]),
    );
    await db.delete(childProfilesTable).where(
      inArray(childProfilesTable.id, [child.id, otherChild.id]),
    );
    await db.delete(organizationMembershipsTable).where(
      eq(organizationMembershipsTable.organizationId, organization.id),
    );
    await db.delete(usersTable).where(inArray(usersTable.id, Object.values(ids)));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
  }
});
