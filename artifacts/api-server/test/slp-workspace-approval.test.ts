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
