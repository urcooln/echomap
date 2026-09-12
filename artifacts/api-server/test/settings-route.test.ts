import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  careTeamInvitationsTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  slpProfilesTable,
  userNotificationPreferencesTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("settings resolve identity and access from the authenticated actor", async () => {
  const suffix = randomUUID();
  const [organization, otherOrganization] = await db
    .insert(organizationsTable)
    .values([
      {
        slug: `settings-${suffix}`,
        name: "Settings Test District",
      },
      {
        slug: `settings-other-${suffix}`,
        name: "Unrelated District",
      },
    ])
    .returning();
  assert.ok(organization && otherOrganization);

  const userIds = {
    slp: `settings-slp-${suffix}`,
    teacher: `settings-teacher-${suffix}`,
    parent: `settings-parent-${suffix}`,
    outsider: `settings-outsider-${suffix}`,
    emptyParent: `settings-empty-parent-${suffix}`,
    demo: `settings-demo-${suffix}`,
  };
  await db.insert(usersTable).values([
    {
      id: userIds.slp,
      identityProvider: "settings-test",
      providerSubject: userIds.slp,
      displayName: "Avery Speech",
      email: "avery.speech@example.test",
    },
    {
      id: userIds.teacher,
      identityProvider: "settings-test",
      providerSubject: userIds.teacher,
      displayName: "Taylor Teacher",
      email: "taylor.teacher@example.test",
    },
    {
      id: userIds.parent,
      identityProvider: "settings-test",
      providerSubject: userIds.parent,
      displayName: "Parker Parent",
      email: "parker.parent@example.test",
    },
    {
      id: userIds.outsider,
      identityProvider: "settings-test",
      providerSubject: userIds.outsider,
      displayName: "Outside Clinician",
      email: "outside@example.test",
    },
    {
      id: userIds.emptyParent,
      identityProvider: "settings-test",
      providerSubject: userIds.emptyParent,
      displayName: "Empty Parent",
      email: "empty.parent@example.test",
    },
    {
      id: userIds.demo,
      identityProvider: "settings-test",
      providerSubject: userIds.demo,
      displayName: "Stored Demo User",
      email: "stored.demo@example.test",
    },
  ]);
  await db.insert(organizationMembershipsTable).values([
    {
      organizationId: organization.id,
      userId: userIds.slp,
      role: "clinician",
    },
    {
      organizationId: organization.id,
      userId: userIds.teacher,
      role: "teacher",
    },
    {
      organizationId: organization.id,
      userId: userIds.parent,
      role: "parent",
    },
    {
      organizationId: organization.id,
      userId: userIds.emptyParent,
      role: "parent",
    },
    {
      organizationId: organization.id,
      userId: userIds.demo,
      role: "admin",
    },
    {
      organizationId: otherOrganization.id,
      userId: userIds.outsider,
      role: "clinician",
    },
  ]);
  await db.insert(slpProfilesTable).values({
    organizationId: organization.id,
    userId: userIds.slp,
    firstName: "Avery",
    lastName: "Speech",
    professionalTitle: "Speech-Language Pathologist",
    school: "Cedar School",
    schoolDistrict: "Settings Test District",
    licensureState: "Ohio",
    licenseNumber: "SLP-TEST-123",
    licenseExpirationDate: "2027-09-12",
    ashaCccSlpNumber: "ASHA-TEST-456",
  });

  const [assignedChild, unrelatedChild] = await db
    .insert(childProfilesTable)
    .values([
      {
        organizationId: organization.id,
        displayName: "Assigned Student",
        school: "Cedar School",
        grade: "2nd grade",
      },
      {
        organizationId: otherOrganization.id,
        displayName: "Unrelated Student",
        school: "Other School",
        grade: "3rd grade",
      },
    ])
    .returning();
  assert.ok(assignedChild && unrelatedChild);
  await db.insert(childCareTeamMembershipsTable).values([
    {
      childId: assignedChild.id,
      userId: userIds.slp,
      role: "clinician",
    },
    {
      childId: assignedChild.id,
      userId: userIds.teacher,
      role: "teacher",
    },
    {
      childId: assignedChild.id,
      userId: userIds.parent,
      role: "parent",
    },
    {
      childId: unrelatedChild.id,
      userId: userIds.outsider,
      role: "clinician",
    },
  ]);
  await db.insert(careTeamInvitationsTable).values([
    {
      organizationId: organization.id,
      childId: assignedChild.id,
      invitedEmail: "pending.teacher@example.test",
      invitedRole: "teacher",
      invitedByUserId: userIds.slp,
    },
    {
      organizationId: otherOrganization.id,
      childId: unrelatedChild.id,
      invitedEmail: "private.invite@example.test",
      invitedRole: "parent",
      invitedByUserId: userIds.outsider,
    },
  ]);

  const actor = (
    userId: string,
    author: string,
    role: ResolvedCareTeamActor["role"],
    organizationId: number,
    childIds: number[],
    extra: Partial<ResolvedCareTeamActor> = {},
  ): ResolvedCareTeamActor => ({
    userId,
    author,
    role,
    organizationId,
    childIds,
    isAdmin: role === "Administrator",
    accountStatus: "active",
    onboardingComplete: true,
    expiresAt: Date.now() + 60_000,
    ...extra,
  });
  const actors = {
    slp: actor(
      userIds.slp,
      "Avery Speech",
      "SLP",
      organization.id,
      [assignedChild.id],
    ),
    teacher: actor(
      userIds.teacher,
      "Taylor Teacher",
      "Teacher",
      organization.id,
      [assignedChild.id],
    ),
    parent: actor(
      userIds.parent,
      "Parker Parent",
      "Parent",
      organization.id,
      [assignedChild.id],
    ),
    emptyParent: actor(
      userIds.emptyParent,
      "Empty Parent",
      "Parent",
      organization.id,
      [],
    ),
    demo: actor(
      userIds.demo,
      "Development Administrator",
      "Administrator",
      organization.id,
      [assignedChild.id],
      { isAdmin: true, isSuperAdmin: true, isDevelopmentDemo: true },
    ),
  } satisfies Record<string, ResolvedCareTeamActor>;

  let currentActor: ResolvedCareTeamActor | undefined;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    currentActor = actors[String(req.header("x-test-actor")) as keyof typeof actors];
    req.childledActor = currentActor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = async (
    actorName: keyof typeof actors | "none",
    path = "/settings",
    init?: RequestInit,
  ) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-test-actor": actorName,
        ...init?.headers,
      },
    });
    return {
      status: response.status,
      body: (await response.json()) as Record<string, any>,
    };
  };

  try {
    assert.equal((await request("none")).status, 401);

    const slp = await request(
      "slp",
      `/settings?userId=${encodeURIComponent(userIds.outsider)}&organizationId=${otherOrganization.id}`,
    );
    assert.equal(slp.status, 200);
    assert.equal(slp.body.identity.name, "Avery Speech");
    assert.equal(slp.body.identity.email, "avery.speech@example.test");
    assert.equal(slp.body.identity.role, "SLP");
    assert.equal(slp.body.identity.accountType, "Speech-Language Pathologist");
    assert.equal(slp.body.identity.isDevelopmentDemo, false);
    assert.equal(slp.body.professionalProfile.school, "Cedar School");
    assert.equal(slp.body.professionalProfile.schoolDistrict, "Settings Test District");
    assert.equal(slp.body.professionalProfile.licensureState, "Ohio");
    assert.equal(slp.body.professionalProfile.licenseNumber, "SLP-TEST-123");
    assert.deepEqual(
      slp.body.students.map((student: { name: string }) => student.name),
      ["Assigned Student"],
    );
    assert.deepEqual(
      new Set(
        slp.body.students[0].careTeam.map(
          (member: { name: string }) => member.name,
        ),
      ),
      new Set(["Avery Speech", "Taylor Teacher", "Parker Parent"]),
    );
    assert.deepEqual(
      slp.body.pendingInvitations.map(
        (invitation: { email: string }) => invitation.email,
      ),
      ["pending.teacher@example.test"],
    );
    assert.equal(JSON.stringify(slp.body).includes("Maya Chen"), false);
    assert.equal(JSON.stringify(slp.body).includes("Care team lead"), false);
    assert.equal(JSON.stringify(slp.body).includes("Unrelated Student"), false);
    assert.equal(JSON.stringify(slp.body).includes("private.invite"), false);

    for (const [actorName, expected] of [
      ["teacher", { name: "Taylor Teacher", role: "Teacher" }],
      ["parent", { name: "Parker Parent", role: "Parent" }],
    ] as const) {
      const response = await request(actorName);
      assert.equal(response.status, 200);
      assert.equal(response.body.identity.name, expected.name);
      assert.equal(response.body.identity.role, expected.role);
      assert.equal(response.body.professionalProfile, undefined);
      assert.deepEqual(
        response.body.students.map((student: { name: string }) => student.name),
        ["Assigned Student"],
      );
      assert.deepEqual(response.body.students[0].careTeam, []);
      assert.deepEqual(response.body.pendingInvitations, []);
      assert.equal(JSON.stringify(response.body).includes("Maya Chen"), false);
      assert.equal(JSON.stringify(response.body).includes("SLP-TEST-123"), false);
    }

    const emptyParent = await request("emptyParent");
    assert.equal(emptyParent.status, 200);
    assert.equal(emptyParent.body.identity.name, "Empty Parent");
    assert.deepEqual(emptyParent.body.students, []);
    assert.equal(JSON.stringify(emptyParent.body).includes("Maya Chen"), false);

    const demo = await request("demo");
    assert.equal(demo.status, 200);
    assert.equal(demo.body.identity.name, "Stored Demo User");
    assert.equal(demo.body.identity.email, "stored.demo@example.test");
    assert.equal(demo.body.identity.accountType, "Care team lead");
    assert.equal(demo.body.identity.isDevelopmentDemo, true);
    assert.equal(demo.body.professionalProfile, undefined);

    const patched = await request("teacher", "/settings", {
      method: "PATCH",
      body: JSON.stringify({
        messages: false,
        studentUpdates: true,
        communicationActivity: false,
        weeklySummary: true,
        userId: userIds.outsider,
        organizationId: otherOrganization.id,
      }),
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.messages, false);
    const savedPreferences = await db
      .select()
      .from(userNotificationPreferencesTable)
      .where(
        and(
          eq(userNotificationPreferencesTable.organizationId, organization.id),
          eq(userNotificationPreferencesTable.userId, userIds.teacher),
        ),
      );
    assert.equal(savedPreferences.length, 1);
    assert.equal(savedPreferences[0]?.communicationActivity, false);
    const forgedTargetPreferences = await db
      .select()
      .from(userNotificationPreferencesTable)
      .where(eq(userNotificationPreferencesTable.userId, userIds.outsider));
    assert.equal(forgedTargetPreferences.length, 0);
  } finally {
    server.close();
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, userIds.teacher));
    await db
      .delete(userNotificationPreferencesTable)
      .where(eq(userNotificationPreferencesTable.organizationId, organization.id));
    await db
      .delete(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.organizationId, organization.id));
    await db
      .delete(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.organizationId, otherOrganization.id));
    await db
      .delete(childCareTeamMembershipsTable)
      .where(eq(childCareTeamMembershipsTable.childId, assignedChild.id));
    await db
      .delete(childCareTeamMembershipsTable)
      .where(eq(childCareTeamMembershipsTable.childId, unrelatedChild.id));
    await db
      .delete(childProfilesTable)
      .where(eq(childProfilesTable.id, assignedChild.id));
    await db
      .delete(childProfilesTable)
      .where(eq(childProfilesTable.id, unrelatedChild.id));
    await db
      .delete(slpProfilesTable)
      .where(eq(slpProfilesTable.userId, userIds.slp));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.organizationId, organization.id));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.organizationId, otherOrganization.id));
    for (const userId of Object.values(userIds)) {
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, otherOrganization.id));
  }
});
