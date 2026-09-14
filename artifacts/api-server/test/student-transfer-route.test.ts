import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  betaControlsTable,
  careTeamInvitationsTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  communicationGoalsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  slpProfilesTable,
  studentTransfersTable,
  teamConversationsTable,
  therapySessionsTable,
  userAgreementAcceptancesTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";
import { provisionClerkInvitation } from "../src/lib/clerk-invitation-provisioning";
import { completeSlpOnboardingAccount } from "../src/lib/slp-onboarding-account";

test.after(async () => {
  await pool.end();
});

test("student transfers preserve the child record and complete only for an eligible SLP", async () => {
  const suffix = randomUUID();
  const sourceId = `transfer-source-${suffix}`;
  const destinationId = `transfer-destination-${suffix}`;
  const parentId = `transfer-parent-${suffix}`;
  const teacherId = `transfer-teacher-${suffix}`;
  const externalSlpId = `transfer-external-${suffix}`;
  const destinationEmail = `destination-${suffix}@example.test`;
  const invitedEmail = `invited-${suffix}@example.test`;
  const clerkUserId = `user_transfer_${suffix}`;
  const invitedUserId = `clerk_${clerkUserId}`;
  const userIds = [
    sourceId,
    destinationId,
    parentId,
    teacherId,
    externalSlpId,
    invitedUserId,
  ];
  const [existingControls] = await db
    .select()
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  await db
    .insert(betaControlsTable)
    .values({ id: 1 })
    .onConflictDoUpdate({
      target: betaControlsTable.id,
      set: { enabled: true, defaultOrganizationUserLimit: null },
    });
  const [organization, externalOrganization] = await db
    .insert(organizationsTable)
    .values([
      {
        slug: `student-transfer-${suffix}`,
        name: "Student Transfer Test",
        betaApprovedAt: new Date(),
      },
      {
        slug: `student-transfer-external-${suffix}`,
        name: "External SLP Workspace",
        betaApprovedAt: new Date(),
      },
    ])
    .returning();
  assert.ok(organization && externalOrganization);
  await db.insert(usersTable).values([
    {
      id: sourceId,
      identityProvider: "student-transfer-test",
      providerSubject: sourceId,
      displayName: "Dr. Ortiz",
      email: `source-${suffix}@example.test`,
    },
    {
      id: destinationId,
      identityProvider: "student-transfer-test",
      providerSubject: destinationId,
      displayName: "Dr. Sarah Lee",
      email: destinationEmail,
    },
    {
      id: parentId,
      identityProvider: "student-transfer-test",
      providerSubject: parentId,
      displayName: "Test Parent",
      email: `parent-${suffix}@example.test`,
    },
    {
      id: teacherId,
      identityProvider: "student-transfer-test",
      providerSubject: teacherId,
      displayName: "Test Teacher",
      email: `teacher-${suffix}@example.test`,
    },
    {
      id: externalSlpId,
      identityProvider: "student-transfer-test",
      providerSubject: externalSlpId,
      displayName: "External SLP",
      email: `external-${suffix}@example.test`,
    },
  ]);
  const onboardedAt = new Date();
  await db.insert(organizationMembershipsTable).values([
    {
      organizationId: organization.id,
      userId: sourceId,
      role: "clinician",
      accountStatus: "active",
      onboardingCompletedAt: onboardedAt,
    },
    {
      organizationId: organization.id,
      userId: destinationId,
      role: "clinician",
      accountStatus: "active",
      onboardingCompletedAt: onboardedAt,
    },
    {
      organizationId: organization.id,
      userId: parentId,
      role: "parent",
    },
    {
      organizationId: organization.id,
      userId: teacherId,
      role: "teacher",
    },
    {
      organizationId: externalOrganization.id,
      userId: externalSlpId,
      role: "clinician",
      accountStatus: "active",
      onboardingCompletedAt: onboardedAt,
    },
  ]);
  await db.insert(slpProfilesTable).values({
    organizationId: organization.id,
    userId: destinationId,
    firstName: "Sarah",
    lastName: "Lee",
    professionalTitle: "Speech-Language Pathologist",
    school: "Pilot School",
    schoolDistrict: "Pilot District",
    licensureState: "Ohio",
    licenseNumber: "TEST-DESTINATION",
  });
  const [immediateChild, invitedChild, cancelledChild] = await db
    .insert(childProfilesTable)
    .values([
      {
        organizationId: organization.id,
        displayName: "Oliver Bennett",
        firstName: "Oliver",
        lastName: "Bennett",
      },
      {
        organizationId: organization.id,
        displayName: "Manny Rivera",
        firstName: "Manny",
        lastName: "Rivera",
      },
      {
        organizationId: organization.id,
        displayName: "Ava Johnson",
        firstName: "Ava",
        lastName: "Johnson",
      },
    ])
    .returning();
  assert.ok(immediateChild && invitedChild && cancelledChild);
  const childIds = [immediateChild.id, invitedChild.id, cancelledChild.id];
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: immediateChild.id, userId: sourceId, role: "clinician" },
    { childId: immediateChild.id, userId: parentId, role: "parent" },
    { childId: immediateChild.id, userId: teacherId, role: "teacher" },
    { childId: invitedChild.id, userId: sourceId, role: "clinician" },
    { childId: invitedChild.id, userId: parentId, role: "parent" },
    { childId: invitedChild.id, userId: teacherId, role: "teacher" },
    { childId: cancelledChild.id, userId: sourceId, role: "clinician" },
  ]);
  const [goal] = await db
    .insert(communicationGoalsTable)
    .values({
      organizationId: organization.id,
      childId: immediateChild.id,
      title: "Functional requests",
      goalArea: "Expressive communication",
      description: "Use an available mode to request a preferred activity.",
      startDate: "2026-09-01",
      createdByUserId: sourceId,
      updatedByUserId: sourceId,
    })
    .returning();
  const [session] = await db
    .insert(therapySessionsTable)
    .values({
      organizationId: organization.id,
      childId: immediateChild.id,
      sessionMode: "manual",
      sessionStatus: "completed",
      sessionDate: "2026-09-10",
      durationSeconds: 1800,
      durationSource: "manual",
      note: "Historical session",
      createdByUserId: sourceId,
    })
    .returning();
  const [phrase] = await db
    .insert(clinicalGestaltsTable)
    .values({
      organizationId: organization.id,
      childId: immediateChild.id,
      phrase: "Let's go",
      normalizedPhrase: "let's go",
      meaning: "Requests a transition",
      communicationFunction: "Requesting",
      contexts: ["School"],
      emotionalState: "Regulated",
      source: "SLP",
      createdByUserId: sourceId,
    })
    .returning();
  assert.ok(goal && session && phrase);

  let actor: ResolvedCareTeamActor = {
    userId: sourceId,
    author: "Dr. Ortiz",
    role: "SLP",
    childIds,
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
    req.log = {
      error: (details: unknown, message?: string) =>
        console.error(message, details),
      warn: () => undefined,
    } as typeof req.log;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const value = app.listen(0, () => resolve(value));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(base + path, init);
    const text = await response.text();
    return {
      status: response.status,
      body: text ? (JSON.parse(text) as Record<string, any>) : {},
    };
  };
  const post = (path: string, body: Record<string, unknown>) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    const available = await post("/student-transfers/lookup", {
      childId: immediateChild.id,
      email: destinationEmail.toUpperCase(),
    });
    assert.equal(available.status, 200);
    assert.equal(available.body.status, "available");
    assert.equal(available.body.slp.name, "Dr. Sarah Lee");

    const sameSlp = await post("/student-transfers/lookup", {
      childId: immediateChild.id,
      email: `source-${suffix}@example.test`,
    });
    assert.equal(sameSlp.body.status, "current_slp");
    const wrongRole = await post("/student-transfers/lookup", {
      childId: immediateChild.id,
      email: `teacher-${suffix}@example.test`,
    });
    assert.equal(wrongRole.body.status, "different_role");
    const differentWorkspace = await post("/student-transfers/lookup", {
      childId: immediateChild.id,
      email: `external-${suffix}@example.test`,
    });
    assert.equal(differentWorkspace.body.status, "available");
    assert.equal(differentWorkspace.body.slp.name, "External SLP");

    const transferred = await post("/student-transfers", {
      childId: immediateChild.id,
      email: destinationEmail,
    });
    assert.equal(transferred.status, 201);
    assert.equal(transferred.body.status, "completed");
    assert.equal(transferred.body.childLedId, immediateChild.childLedId);
    const clinicianMemberships = await db
      .select()
      .from(childCareTeamMembershipsTable)
      .where(
        and(
          eq(childCareTeamMembershipsTable.childId, immediateChild.id),
          inArray(childCareTeamMembershipsTable.userId, [
            sourceId,
            destinationId,
          ]),
        ),
      );
    assert.equal(
      clinicianMemberships.find((item) => item.userId === sourceId)?.active,
      false,
    );
    assert.equal(
      clinicianMemberships.find((item) => item.userId === destinationId)
        ?.active,
      true,
    );
    const retainedCareTeam = await db
      .select()
      .from(childCareTeamMembershipsTable)
      .where(eq(childCareTeamMembershipsTable.childId, immediateChild.id));
    assert.equal(
      retainedCareTeam.find((item) => item.userId === parentId)?.active,
      true,
    );
    assert.equal(
      retainedCareTeam.find((item) => item.userId === teacherId)?.active,
      true,
    );
    assert.equal(
      (
        await db
          .select()
          .from(therapySessionsTable)
          .where(eq(therapySessionsTable.id, session.id))
      )[0]?.createdByUserId,
      sourceId,
    );
    assert.equal(
      (
        await db
          .select()
          .from(communicationGoalsTable)
          .where(eq(communicationGoalsTable.id, goal.id))
      )[0]?.childId,
      immediateChild.id,
    );
    assert.equal(
      (
        await db
          .select()
          .from(clinicalGestaltsTable)
          .where(eq(clinicalGestaltsTable.id, phrase.id))
      )[0]?.childId,
      immediateChild.id,
    );

    actor = { ...actor, childIds: [] };
    assert.equal(
      (await request(`/child?childId=${immediateChild.id}`)).status,
      403,
    );
    actor = {
      ...actor,
      userId: destinationId,
      author: "Dr. Sarah Lee",
      childIds: [immediateChild.id],
    };
    const destinationChildren = await request("/children");
    assert.equal(destinationChildren.status, 200);
    assert.equal(
      destinationChildren.body.some(
        (child: { id: number; childLedId: string }) =>
          child.id === immediateChild.id &&
          child.childLedId === immediateChild.childLedId,
      ),
      true,
    );

    const crossWorkspaceTransfer = await post("/student-transfers", {
      childId: immediateChild.id,
      email: `external-${suffix}@example.test`,
    });
    assert.equal(
      crossWorkspaceTransfer.status,
      201,
      JSON.stringify(crossWorkspaceTransfer.body),
    );
    assert.equal(crossWorkspaceTransfer.body.status, "completed");
    assert.equal(
      crossWorkspaceTransfer.body.childLedId,
      immediateChild.childLedId,
    );
    assert.equal(
      (
        await db
          .select()
          .from(childProfilesTable)
          .where(eq(childProfilesTable.id, immediateChild.id))
      )[0]?.organizationId,
      externalOrganization.id,
    );
    assert.equal(
      (
        await db
          .select()
          .from(therapySessionsTable)
          .where(eq(therapySessionsTable.id, session.id))
      )[0]?.organizationId,
      externalOrganization.id,
    );
    assert.equal(
      (
        await db
          .select()
          .from(communicationGoalsTable)
          .where(eq(communicationGoalsTable.id, goal.id))
      )[0]?.organizationId,
      externalOrganization.id,
    );
    const retainedWorkspaceMemberships = await db
      .select()
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(
            organizationMembershipsTable.organizationId,
            externalOrganization.id,
          ),
          inArray(organizationMembershipsTable.userId, [parentId, teacherId]),
        ),
      );
    assert.equal(
      retainedWorkspaceMemberships.find((item) => item.userId === parentId)
        ?.role,
      "parent",
    );
    assert.equal(
      retainedWorkspaceMemberships.find((item) => item.userId === teacherId)
        ?.role,
      "teacher",
    );
    actor = {
      ...actor,
      userId: destinationId,
      childIds: [],
      organizationId: organization.id,
    };
    assert.equal(
      (await request(`/child?childId=${immediateChild.id}`)).status,
      403,
    );
    actor = {
      ...actor,
      userId: externalSlpId,
      author: "External SLP",
      childIds: [immediateChild.id],
      organizationId: externalOrganization.id,
    };
    const externalChildren = await request("/children");
    assert.equal(externalChildren.status, 200);
    assert.equal(
      externalChildren.body.some(
        (child: { id: number; childLedId: string }) =>
          child.id === immediateChild.id &&
          child.childLedId === immediateChild.childLedId,
      ),
      true,
    );

    actor = {
      ...actor,
      userId: sourceId,
      author: "Dr. Ortiz",
      childIds: [invitedChild.id],
      organizationId: organization.id,
    };
    const pending = await post("/student-transfers", {
      childId: invitedChild.id,
      email: invitedEmail,
    });
    assert.equal(pending.status, 201);
    assert.equal(pending.body.status, "pending");
    assert.match(pending.body.invitationPath, /^\/sign-up\?token=/);
    const pendingHistory = await request(
      `/student-transfers?childId=${invitedChild.id}`,
    );
    assert.equal(pendingHistory.status, 200);
    assert.equal(pendingHistory.body[0]?.id, pending.body.id);
    assert.equal(pendingHistory.body[0]?.status, "pending");
    const sourceBeforeOnboarding = await db
      .select()
      .from(childCareTeamMembershipsTable)
      .where(
        and(
          eq(childCareTeamMembershipsTable.childId, invitedChild.id),
          eq(childCareTeamMembershipsTable.userId, sourceId),
        ),
      );
    assert.equal(sourceBeforeOnboarding[0]?.active, true);

    const token = new URL(
      pending.body.invitationPath,
      "http://localhost",
    ).searchParams.get("token");
    assert.ok(token);
    const provisioned = await provisionClerkInvitation({
      clerkUser: {
        id: clerkUserId,
        fullName: "Invited SLP",
        username: null,
        publicMetadata: {},
        emailAddresses: [
          {
            emailAddress: invitedEmail,
            verification: { status: "verified" },
          },
        ],
      },
      token,
    });
    assert.equal(provisioned?.onboardingRequired, true);
    assert.equal(
      (
        await db
          .select()
          .from(studentTransfersTable)
          .where(eq(studentTransfersTable.id, pending.body.id))
      )[0]?.status,
      "pending",
    );

    const onboarding = await completeSlpOnboardingAccount({
      organizationId: organization.id,
      userId: invitedUserId,
      clerkUserId,
      profile: {
        firstName: "Invited",
        lastName: "SLP",
        professionalTitle: "Speech-Language Pathologist",
        school: "Pilot School",
        schoolDistrict: "Pilot District",
        licensureState: "Ohio",
        licenseNumber: "SELF-REPORTED-TRANSFER",
        licenseExpirationDate: null,
        ashaCccSlpNumber: null,
      },
    });
    assert.deepEqual(onboarding.completedTransferIds, [pending.body.id]);
    const completedPending = await db
      .select()
      .from(studentTransfersTable)
      .where(eq(studentTransfersTable.id, pending.body.id));
    assert.equal(completedPending[0]?.status, "completed");
    assert.equal(completedPending[0]?.toSlpUserId, invitedUserId);
    const invitedChildClinicians = await db
      .select()
      .from(childCareTeamMembershipsTable)
      .where(
        and(
          eq(childCareTeamMembershipsTable.childId, invitedChild.id),
          inArray(childCareTeamMembershipsTable.userId, [
            sourceId,
            invitedUserId,
          ]),
        ),
      );
    assert.equal(
      invitedChildClinicians.find((item) => item.userId === sourceId)?.active,
      false,
    );
    assert.equal(
      invitedChildClinicians.find((item) => item.userId === invitedUserId)
        ?.active,
      true,
    );

    actor = {
      ...actor,
      userId: sourceId,
      author: "Dr. Ortiz",
      role: "SLP",
      childIds: [cancelledChild.id],
    };
    const toCancel = await post("/student-transfers", {
      childId: cancelledChild.id,
      email: `cancelled-${suffix}@example.test`,
    });
    assert.equal(toCancel.status, 201);
    assert.equal(toCancel.body.status, "pending");
    const cancelled = await post(
      `/student-transfers/${toCancel.body.id}/cancel`,
      {},
    );
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, "cancelled");
    assert.equal(
      (
        await db
          .select()
          .from(childCareTeamMembershipsTable)
          .where(
            and(
              eq(childCareTeamMembershipsTable.childId, cancelledChild.id),
              eq(childCareTeamMembershipsTable.userId, sourceId),
            ),
          )
      )[0]?.active,
      true,
    );

    actor = { ...actor, role: "Parent", childIds: [invitedChild.id] };
    assert.equal(
      (
        await post("/student-transfers/lookup", {
          childId: invitedChild.id,
          email: destinationEmail,
        })
      ).status,
      403,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db
      .delete(securityAuditLogsTable)
      .where(inArray(securityAuditLogsTable.userId, userIds));
    await db
      .delete(teamConversationsTable)
      .where(inArray(teamConversationsTable.childId, childIds));
    await db
      .delete(studentTransfersTable)
      .where(eq(studentTransfersTable.organizationId, organization.id));
    await db
      .delete(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.organizationId, organization.id));
    await db
      .delete(therapySessionsTable)
      .where(inArray(therapySessionsTable.childId, childIds));
    await db
      .delete(communicationGoalsTable)
      .where(inArray(communicationGoalsTable.childId, childIds));
    await db
      .delete(clinicalGestaltsTable)
      .where(inArray(clinicalGestaltsTable.childId, childIds));
    await db
      .delete(childCareTeamMembershipsTable)
      .where(inArray(childCareTeamMembershipsTable.childId, childIds));
    await db
      .delete(childProfilesTable)
      .where(inArray(childProfilesTable.id, childIds));
    await db
      .delete(userAgreementAcceptancesTable)
      .where(inArray(userAgreementAcceptancesTable.userId, userIds));
    await db
      .delete(slpProfilesTable)
      .where(inArray(slpProfilesTable.userId, userIds));
    await db
      .delete(organizationMembershipsTable)
      .where(inArray(organizationMembershipsTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db
      .delete(organizationsTable)
      .where(
        inArray(organizationsTable.id, [
          organization.id,
          externalOrganization.id,
        ]),
      );
    if (existingControls) {
      await db
        .update(betaControlsTable)
        .set({
          enabled: existingControls.enabled,
          defaultOrganizationUserLimit:
            existingControls.defaultOrganizationUserLimit,
        })
        .where(eq(betaControlsTable.id, 1));
    }
  }
});
