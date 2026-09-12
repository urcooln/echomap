import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalObservationsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  teamMessagesTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import type {
  CareTeamRole,
  ResolvedCareTeamActor,
} from "../src/lib/auth-context";
import router from "../src/routes/childled";

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

test("a parent observation notifies only assigned SLPs and rejects parent video uploads", async () => {
  const suffix = randomUUID();
  const userIds = {
    parent: `parent-observation-parent-${suffix}`,
    firstSlp: `parent-observation-slp-1-${suffix}`,
    secondSlp: `parent-observation-slp-2-${suffix}`,
    teacher: `parent-observation-teacher-${suffix}`,
    unrelatedSlp: `parent-observation-unrelated-slp-${suffix}`,
  };
  const created = {
    organizationId: undefined as number | undefined,
    childIds: [] as number[],
    observationIds: [] as number[],
    messageIds: [] as number[],
  };

  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `parent-observation-${suffix}`,
      name: "Parent observation notification test",
    })
    .returning({ id: organizationsTable.id });
  assert.ok(organization);
  created.organizationId = organization.id;

  await db.insert(usersTable).values([
    {
      id: userIds.parent,
      identityProvider: "parent-observation-test",
      providerSubject: userIds.parent,
      displayName: "Jordan Parent",
    },
    {
      id: userIds.firstSlp,
      identityProvider: "parent-observation-test",
      providerSubject: userIds.firstSlp,
      displayName: "First SLP",
    },
    {
      id: userIds.secondSlp,
      identityProvider: "parent-observation-test",
      providerSubject: userIds.secondSlp,
      displayName: "Second SLP",
    },
    {
      id: userIds.teacher,
      identityProvider: "parent-observation-test",
      providerSubject: userIds.teacher,
      displayName: "Assigned Teacher",
    },
    {
      id: userIds.unrelatedSlp,
      identityProvider: "parent-observation-test",
      providerSubject: userIds.unrelatedSlp,
      displayName: "Unrelated SLP",
    },
  ]);
  await db.insert(organizationMembershipsTable).values([
    { organizationId: organization.id, userId: userIds.parent, role: "parent" },
    {
      organizationId: organization.id,
      userId: userIds.firstSlp,
      role: "clinician",
    },
    { organizationId: organization.id, userId: userIds.secondSlp, role: "slp" },
    {
      organizationId: organization.id,
      userId: userIds.teacher,
      role: "teacher",
    },
    {
      organizationId: organization.id,
      userId: userIds.unrelatedSlp,
      role: "clinician",
    },
  ]);

  const children = await db
    .insert(childProfilesTable)
    .values([
      { organizationId: organization.id, displayName: "Johnny Smith" },
      { organizationId: organization.id, displayName: "Other Student" },
    ])
    .returning({ id: childProfilesTable.id });
  assert.equal(children.length, 2);
  const child = children[0];
  const otherChild = children[1];
  assert.ok(child);
  assert.ok(otherChild);
  created.childIds.push(child.id, otherChild.id);

  await db.insert(childCareTeamMembershipsTable).values([
    { childId: child.id, userId: userIds.parent, role: "parent" },
    { childId: child.id, userId: userIds.firstSlp, role: "clinician" },
    { childId: child.id, userId: userIds.secondSlp, role: "slp" },
    { childId: child.id, userId: userIds.teacher, role: "teacher" },
    { childId: otherChild.id, userId: userIds.unrelatedSlp, role: "clinician" },
  ]);

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
  const parent = makeActor(
    userIds.parent,
    "Jordan Parent",
    "Parent",
    organization.id,
    [child.id],
  );
  const jsonRequest = (
    actor: ResolvedCareTeamActor,
    path: string,
    body: Record<string, unknown>,
  ) =>
    request(actor, path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    const saved = await jsonRequest(
      parent,
      `/observations?childId=${child.id}`,
      {
        body: "Johnny used a new greeting independently at breakfast.",
        context: "Home",
      },
    );
    assert.equal(saved.status, 201);
    created.observationIds.push(saved.body.id);

    const notifications = await db
      .select()
      .from(teamMessagesTable)
      .where(eq(teamMessagesTable.childId, child.id));
    created.messageIds.push(...notifications.map((message) => message.id));
    assert.equal(notifications.length, 2);
    assert.deepEqual(
      notifications.map((message) => message.recipientUserId).sort(),
      [userIds.firstSlp, userIds.secondSlp].sort(),
    );
    assert.ok(
      notifications.every(
        (message) =>
          message.messageType === "notification" &&
          message.senderUserId === userIds.parent &&
          message.senderRole === "parent" &&
          message.body.includes("New Parent Update — Johnny Smith") &&
          message.body.includes("new greeting independently"),
      ),
    );

    const firstSlp = makeActor(
      userIds.firstSlp,
      "First SLP",
      "SLP",
      organization.id,
      [child.id],
    );
    const secondSlp = makeActor(
      userIds.secondSlp,
      "Second SLP",
      "SLP",
      organization.id,
      [child.id],
    );
    const teacher = makeActor(
      userIds.teacher,
      "Assigned Teacher",
      "Teacher",
      organization.id,
      [child.id],
    );

    const firstSlpInbox = await request(firstSlp, "/team-inbox");
    assert.equal(firstSlpInbox.status, 200);
    assert.equal(firstSlpInbox.body.totalUnread, 0);
    assert.deepEqual(firstSlpInbox.body.conversations, []);
    assert.deepEqual(firstSlpInbox.body.messages, []);

    const secondSlpInbox = await request(secondSlp, "/team-inbox");
    assert.equal(secondSlpInbox.status, 200);
    assert.equal(secondSlpInbox.body.totalUnread, 0);
    assert.deepEqual(secondSlpInbox.body.conversations, []);
    assert.deepEqual(secondSlpInbox.body.messages, []);

    const teacherInbox = await request(teacher, "/team-inbox");
    assert.equal(teacherInbox.status, 200);
    assert.equal(teacherInbox.body.totalUnread, 0);
    assert.deepEqual(teacherInbox.body.messages, []);

    const parentVideoUpload = await jsonRequest(
      parent,
      "/observation-videos/upload-url",
      {
        childId: child.id,
        contentType: "video/mp4",
        sizeBytes: 1024,
        consentConfirmed: true,
        consentConfirmedAt: new Date().toISOString(),
      },
    );
    assert.equal(parentVideoUpload.status, 403);
    assert.match(parentVideoUpload.body.error, /Parent accounts cannot upload/);

    const parentVideoAttachment = await jsonRequest(
      parent,
      `/observations?childId=${child.id}`,
      {
        body: "A direct API submission with a video",
        context: "Home",
        video: {
          uploadId: randomUUID(),
          consentConfirmed: true,
          consentConfirmedAt: new Date().toISOString(),
        },
      },
    );
    assert.equal(parentVideoAttachment.status, 403);
    assert.match(parentVideoAttachment.body.error, /cannot attach videos/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (created.messageIds.length) {
      await db
        .delete(teamMessagesTable)
        .where(inArray(teamMessagesTable.id, created.messageIds));
    }
    if (created.observationIds.length) {
      await db
        .delete(clinicalObservationsTable)
        .where(inArray(clinicalObservationsTable.id, created.observationIds));
    }
    await db
      .delete(securityAuditLogsTable)
      .where(inArray(securityAuditLogsTable.userId, Object.values(userIds)));
    if (created.childIds.length) {
      await db
        .delete(childCareTeamMembershipsTable)
        .where(
          inArray(childCareTeamMembershipsTable.childId, created.childIds),
        );
      await db
        .delete(childProfilesTable)
        .where(inArray(childProfilesTable.id, created.childIds));
    }
    await db
      .delete(organizationMembershipsTable)
      .where(
        inArray(organizationMembershipsTable.userId, Object.values(userIds)),
      );
    await db
      .delete(usersTable)
      .where(inArray(usersTable.id, Object.values(userIds)));
    if (created.organizationId !== undefined) {
      await db
        .delete(organizationsTable)
        .where(eq(organizationsTable.id, created.organizationId));
    }
  }
});
