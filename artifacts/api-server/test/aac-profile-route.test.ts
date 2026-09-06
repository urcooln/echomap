import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  aacProfileHistoryTable,
  aacProfilesTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("AAC profile lifecycle is clinician-owned and removal suppresses legacy child snapshots", async () => {
  const suffix = randomUUID();
  const userId = `aac-profile-user-${suffix}`;
  const [organization] = await db.insert(organizationsTable).values({
    slug: `aac-profile-${suffix}`,
    name: "AAC profile lifecycle test",
  }).returning();
  assert.ok(organization);
  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "aac-profile-test",
    providerSubject: userId,
    displayName: "AAC Profile Clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "clinician",
  });
  const [child] = await db.insert(childProfilesTable).values({
    organizationId: organization.id,
    displayName: "AAC profile child",
    profileDetails: {
      aacSnapshot: {
        isUser: true,
        device: "Legacy device",
        vocabularySystem: "Legacy vocabulary",
        accessMethod: "Legacy access",
        lastConfirmedAt: "2025-01-01",
      },
    },
  }).returning();
  assert.ok(child);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: child.id,
    userId,
    role: "clinician",
  });

  let actor: ResolvedCareTeamActor = {
    userId,
    author: "AAC Profile Clinician",
    role: "SLP",
    childIds: [child.id],
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
  const profileBody = {
    communicationModalities: ["aac", "spoken_language"],
    otherModalityLabel: null,
    aacUserStatus: "yes",
    deviceVendorId: "tobii_dynavox",
    deviceVendorCustomLabel: null,
    deviceModelId: "td_i_110",
    deviceModelCustomLabel: null,
    vocabularySystemId: "td_snap_motor_plan_60",
    vocabularySystemCustomLabel: null,
    accessMethodId: "direct_touch",
    accessMethodCustomLabel: null,
    ownershipId: "family_owned",
    ownershipCustomLabel: null,
    notes: "Confirmed test profile",
    version: 0,
  };

  try {
    actor = { ...actor, role: "Parent" };
    assert.equal((await fetch(`${base}/aac-profile?childId=${child.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profileBody),
    })).status, 403);

    actor = { ...actor, role: "SLP" };
    const create = await fetch(`${base}/aac-profile?childId=${child.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profileBody),
    });
    assert.equal(create.status, 200);
    const created = await create.json();
    assert.equal(created.exists, true);
    assert.equal(created.deviceModelId, "td_i_110");
    assert.equal(created.lastConfirmedBy, "AAC Profile Clinician");

    const childBeforeRemoval = await (await fetch(`${base}/child?childId=${child.id}`)).json();
    assert.equal(childBeforeRemoval.aacSnapshot.device, "Tobii Dynavox · TD I-110");

    const remove = await fetch(`${base}/aac-profile?childId=${child.id}&version=${created.version}`, {
      method: "DELETE",
    });
    assert.equal(remove.status, 200);
    const removed = await remove.json();
    assert.equal(removed.exists, false);
    assert.equal(removed.history[0].action, "removed");
    assert.equal(removed.history[0].previousValue.deviceModelId, "td_i_110");
    assert.equal(removed.history[0].nextValue, null);

    const childAfterRemoval = await (await fetch(`${base}/child?childId=${child.id}`)).json();
    assert.equal(childAfterRemoval.aacSnapshot, undefined);
    const childrenAfterRemoval = await (await fetch(`${base}/children`)).json();
    assert.equal(childrenAfterRemoval[0].aacSnapshot, undefined);
  } finally {
    server.close();
    await db.delete(securityAuditLogsTable).where(eq(securityAuditLogsTable.userId, userId));
    await db.delete(aacProfileHistoryTable).where(eq(aacProfileHistoryTable.childId, child.id));
    await db.delete(aacProfilesTable).where(eq(aacProfilesTable.childId, child.id));
    await db.delete(childCareTeamMembershipsTable).where(eq(childCareTeamMembershipsTable.childId, child.id));
    await db.delete(childProfilesTable).where(eq(childProfilesTable.id, child.id));
    await db.delete(organizationMembershipsTable).where(eq(organizationMembershipsTable.organizationId, organization.id));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
  }
});