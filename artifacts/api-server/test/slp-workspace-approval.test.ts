import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  betaAccessRequestsTable,
  betaControlsTable,
  careTeamInvitationsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  usersTable,
} from "@workspace/db";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";
import router from "../src/routes/childled";

test.after(async () => {
  await pool.end();
});

test("only a Super Admin can approve an SLP into a fresh workspace", async () => {
  const suffix = randomUUID();
  const ownerUserId = `owner-${suffix}`;
  const [existingControls] = await db
    .select()
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  await db
    .insert(betaControlsTable)
    .values({ id: 1, enabled: true, invitationLimitPerDay: 1000 })
    .onConflictDoUpdate({
      target: betaControlsTable.id,
      set: { enabled: true, invitationLimitPerDay: 1000 },
    });
  await db.insert(usersTable).values({
    id: ownerUserId,
    identityProvider: "slp-workspace-approval-test",
    providerSubject: ownerUserId,
    displayName: "Owner Tester",
  });
  const [request] = await db
    .insert(betaAccessRequestsTable)
    .values({
      displayName: "Workspace Test SLP",
      email: `workspace-${suffix}@example.test`,
      organizationName: "Independent Pilot School",
      requestedRole: "Clinician",
    })
    .returning();
  assert.ok(request);

  const slpActor: ResolvedCareTeamActor = {
    userId: `slp-${suffix}`,
    author: "SLP Tester",
    role: "SLP",
    childIds: [],
    isAdmin: false,
    isSuperAdmin: false,
    organizationId: 1,
    onboardingComplete: true,
    expiresAt: Date.now() + 60_000,
  };
  const ownerActor: ResolvedCareTeamActor = {
    ...slpActor,
    userId: ownerUserId,
    author: "Owner Tester",
    role: "Administrator",
    isAdmin: true,
    isSuperAdmin: true,
  };
  let actor = slpActor;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = actor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/admin/beta-access-requests/${request.id}/approve`;
  let organizationId: number | null = null;

  try {
    assert.equal((await fetch(endpoint, { method: "POST" })).status, 403);
    actor = ownerActor;
    const response = await fetch(endpoint, { method: "POST" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accessState, "invite_sent");
    const repeatedResponse = await fetch(endpoint, { method: "POST" });
    assert.equal(repeatedResponse.status, 200);
    assert.equal((await repeatedResponse.json()).status, "approved");

    const [updated] = await db
      .select()
      .from(betaAccessRequestsTable)
      .where(eq(betaAccessRequestsTable.id, request.id));
    assert.equal(updated?.status, "approved");
    organizationId = updated?.approvedOrganizationId ?? null;
    assert.ok(organizationId);
    const [organization] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId));
    assert.equal(organization?.name, "Independent Pilot School");
    assert.notEqual(organization?.slug, "childled-demo");
    assert.ok(organization?.betaApprovedAt);

    const [invitation] = await db
      .select()
      .from(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.id, updated!.invitationId!));
    assert.equal(invitation?.organizationId, organizationId);
    assert.equal(invitation?.invitedRole, "clinician");
    assert.equal(invitation?.accessScope, "organization");
    assert.deepEqual(invitation?.childScope, []);
    assert.ok(updated?.invitationSentAt);

    const revokedResponse = await fetch(
      `http://127.0.0.1:${address.port}/admin/beta-access-requests/${request.id}/revoke-invitation`,
      { method: "POST" },
    );
    assert.equal(revokedResponse.status, 200);
    assert.equal(
      (await revokedResponse.json()).accessState,
      "invitation_revoked",
    );
    const [revokedInvitation] = await db
      .select()
      .from(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.id, updated!.invitationId!));
    assert.equal(revokedInvitation?.status, "revoked");

    const resentResponse = await fetch(
      `http://127.0.0.1:${address.port}/admin/beta-access-requests/${request.id}/resend`,
      { method: "POST" },
    );
    assert.equal(resentResponse.status, 200);
    assert.equal((await resentResponse.json()).accessState, "invite_sent");
    const [resentInvitation] = await db
      .select()
      .from(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.id, updated!.invitationId!));
    assert.equal(resentInvitation?.status, "pending");
    assert.notEqual(resentInvitation?.tokenHash, invitation?.tokenHash);
  } finally {
    server.close();
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.targetId, String(request.id)));
    if (request.invitationId) {
      await db
        .delete(careTeamInvitationsTable)
        .where(eq(careTeamInvitationsTable.id, request.invitationId));
    } else {
      const [updated] = await db
        .select({ invitationId: betaAccessRequestsTable.invitationId })
        .from(betaAccessRequestsTable)
        .where(eq(betaAccessRequestsTable.id, request.id));
      if (updated?.invitationId) {
        await db
          .delete(careTeamInvitationsTable)
          .where(eq(careTeamInvitationsTable.id, updated.invitationId));
      }
    }
    await db
      .delete(betaAccessRequestsTable)
      .where(eq(betaAccessRequestsTable.id, request.id));
    if (organizationId) {
      await db
        .delete(organizationsTable)
        .where(eq(organizationsTable.id, organizationId));
    }
    await db.delete(usersTable).where(eq(usersTable.id, ownerUserId));
    if (existingControls) {
      await db
        .update(betaControlsTable)
        .set({
          enabled: existingControls.enabled,
          invitationLimitPerDay: existingControls.invitationLimitPerDay,
        })
        .where(eq(betaControlsTable.id, 1));
    }
  }
});

test("approval activates an existing SLP without creating another invitation", async () => {
  const suffix = randomUUID();
  const ownerUserId = `existing-owner-${suffix}`;
  const slpUserId = `existing-slp-${suffix}`;
  const email = `existing-${suffix}@example.test`;
  await db
    .insert(betaControlsTable)
    .values({ id: 1, enabled: true, invitationLimitPerDay: 1000 })
    .onConflictDoUpdate({
      target: betaControlsTable.id,
      set: { enabled: true, invitationLimitPerDay: 1000 },
    });
  await db.insert(usersTable).values([
    {
      id: ownerUserId,
      identityProvider: "clerk",
      providerSubject: ownerUserId,
      displayName: "Owner Tester",
    },
    {
      id: slpUserId,
      identityProvider: "clerk",
      providerSubject: slpUserId,
      displayName: "Existing SLP",
      email: email.toUpperCase(),
    },
  ]);
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `existing-slp-${suffix}`,
      name: "Existing SLP Workspace",
    })
    .returning();
  assert.ok(organization);
  const [membership] = await db
    .insert(organizationMembershipsTable)
    .values({
      organizationId: organization.id,
      userId: slpUserId,
      role: "clinician",
      active: false,
      accountStatus: "onboarding",
      onboardingCompletedAt: null,
    })
    .returning();
  const [request] = await db
    .insert(betaAccessRequestsTable)
    .values({
      displayName: "Existing SLP",
      email,
      organizationName: "Existing SLP Workspace",
      requestedRole: "Clinician",
    })
    .returning();
  assert.ok(request && membership);

  const ownerActor: ResolvedCareTeamActor = {
    userId: ownerUserId,
    author: "Owner Tester",
    role: "Administrator",
    childIds: [],
    isAdmin: true,
    isSuperAdmin: true,
    organizationId: organization.id,
    onboardingComplete: true,
    expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = ownerActor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/admin/beta-access-requests/${request.id}/approve`,
      { method: "POST" },
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.deliveryStatus, "existing_account");
    assert.equal(result.accessState, "onboarding");

    const [updatedRequest] = await db
      .select()
      .from(betaAccessRequestsTable)
      .where(eq(betaAccessRequestsTable.id, request.id));
    assert.equal(updatedRequest?.status, "approved");
    assert.equal(updatedRequest?.approvedOrganizationId, organization.id);
    assert.equal(updatedRequest?.invitationId, null);
    const [updatedMembership] = await db
      .select()
      .from(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.id, membership.id));
    assert.equal(updatedMembership?.active, true);
    assert.equal(updatedMembership?.role, "clinician");
    const invitations = await db
      .select()
      .from(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.invitedEmail, email));
    assert.equal(invitations.length, 0);
  } finally {
    server.close();
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.targetId, String(request.id)));
    await db
      .delete(betaAccessRequestsTable)
      .where(eq(betaAccessRequestsTable.id, request.id));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.id, membership.id));
    await db.delete(usersTable).where(eq(usersTable.id, slpUserId));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
    await db.delete(usersTable).where(eq(usersTable.id, ownerUserId));
  }
});

test("approval flags an existing Parent for review without changing the role", async () => {
  const suffix = randomUUID();
  const ownerUserId = `conflict-owner-${suffix}`;
  const parentUserId = `conflict-parent-${suffix}`;
  const email = `conflict-${suffix}@example.test`;
  await db.insert(usersTable).values([
    {
      id: ownerUserId,
      identityProvider: "clerk",
      providerSubject: ownerUserId,
      displayName: "Owner Tester",
    },
    {
      id: parentUserId,
      identityProvider: "clerk",
      providerSubject: parentUserId,
      displayName: "Parent Tester",
      email,
    },
  ]);
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `conflicting-parent-${suffix}`,
      name: "Parent Workspace",
      betaApprovedAt: new Date(),
    })
    .returning();
  assert.ok(organization);
  const [membership] = await db
    .insert(organizationMembershipsTable)
    .values({
      organizationId: organization.id,
      userId: parentUserId,
      role: "parent",
      active: true,
    })
    .returning();
  const [request] = await db
    .insert(betaAccessRequestsTable)
    .values({
      displayName: "Parent Tester",
      email,
      organizationName: "Requested SLP Workspace",
      requestedRole: "Clinician",
    })
    .returning();
  assert.ok(request && membership);

  const ownerActor: ResolvedCareTeamActor = {
    userId: ownerUserId,
    author: "Owner Tester",
    role: "Administrator",
    childIds: [],
    isAdmin: true,
    isSuperAdmin: true,
    organizationId: organization.id,
    onboardingComplete: true,
    expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = ownerActor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/admin/beta-access-requests/${request.id}/approve`,
      { method: "POST" },
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "review_required");
    assert.match(result.message, /Parent account/);

    const [updatedRequest] = await db
      .select()
      .from(betaAccessRequestsTable)
      .where(eq(betaAccessRequestsTable.id, request.id));
    assert.equal(updatedRequest?.status, "review_required");
    assert.equal(updatedRequest?.invitationId, null);
    const [unchangedMembership] = await db
      .select()
      .from(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.id, membership.id));
    assert.equal(unchangedMembership?.role, "parent");
  } finally {
    server.close();
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.targetId, String(request.id)));
    await db
      .delete(betaAccessRequestsTable)
      .where(eq(betaAccessRequestsTable.id, request.id));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.id, membership.id));
    await db.delete(usersTable).where(eq(usersTable.id, parentUserId));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
    await db.delete(usersTable).where(eq(usersTable.id, ownerUserId));
  }
});
