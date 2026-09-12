import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfileConsentRecordsTable,
  childProfilesTable,
  clinicalGestaltsTable,
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

test("child profile edits are clinician-only, tenant-scoped, audited, and preserve clinical records", async () => {
  const suffix = randomUUID();
  const clinicianId = `profile-clinician-${suffix}`;
  const [organization, otherOrganization] = await db
    .insert(organizationsTable)
    .values([
      { slug: `profile-${suffix}`, name: "Profile update test organization" },
      {
        slug: `profile-other-${suffix}`,
        name: "Other profile update organization",
      },
    ])
    .returning();
  assert.ok(organization && otherOrganization);
  await db.insert(usersTable).values({
    id: clinicianId,
    identityProvider: "profile-update-test",
    providerSubject: clinicianId,
    displayName: "Profile Clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId: clinicianId,
    role: "clinician",
  });
  const [child] = await db
    .insert(childProfilesTable)
    .values({
      organizationId: organization.id,
      displayName: "Placeholder Child",
      firstName: "Placeholder",
      lastName: "Child",
      preferredName: "",
      school: "",
      grade: "",
      pronouns: "they/them",
      dateOfBirth: "2019-04-03",
    })
    .returning();
  assert.ok(child);
  assert.match(child.childLedId, /^CLID-[A-Z0-9]{6}$/);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: child.id,
    userId: clinicianId,
    role: "clinician",
  });
  const [gestalt] = await db
    .insert(clinicalGestaltsTable)
    .values({
      organizationId: organization.id,
      childId: child.id,
      phrase: "Let's go",
      normalizedPhrase: "lets go",
      meaning: "Ready to transition",
      communicationFunction: "Transition",
      contexts: ["Therapy"],
      emotionalState: "Regulated",
      source: "Clinician review",
      createdByUserId: clinicianId,
    })
    .returning();
  assert.ok(gestalt);

  let currentActor: ResolvedCareTeamActor | undefined;
  const clinician: ResolvedCareTeamActor = {
    userId: clinicianId,
    author: "Profile Clinician",
    role: "SLP",
    childIds: [child.id],
    isAdmin: false,
    organizationId: organization.id,
    expiresAt: Date.now() + 60_000,
  };
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
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const update = (body: Record<string, unknown>) =>
    fetch(`${base}/child?childId=${child.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const create = (body: Record<string, unknown>) =>
    fetch(`${base}/children`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const completeProfile = {
    firstName: "Jordan",
    lastName: "Bennett",
    preferredName: "Jori",
    school: "Cedar Grove School",
    grade: "2nd grade",
    dateOfBirth: "2019-04-03",
    pronouns: "they/them",
  };
  const createdChildIds: number[] = [];

  try {
    currentActor = undefined;
    assert.equal((await update(completeProfile)).status, 401);
    currentActor = { ...clinician, role: "Parent" };
    assert.equal((await update(completeProfile)).status, 403);
    currentActor = { ...clinician, role: "Teacher" };
    assert.equal((await update(completeProfile)).status, 403);
    currentActor = { ...clinician, organizationId: otherOrganization.id };
    assert.equal((await update(completeProfile)).status, 404);

    currentActor = clinician;
    const response = await update(completeProfile);
    assert.equal(response.status, 200);
    const updated = (await response.json()) as Record<string, unknown>;
    assert.equal(updated.id, child.id);
    assert.equal(updated.name, "Jori");
    assert.equal(updated.firstName, "Jordan");
    assert.equal(updated.lastName, "Bennett");
    assert.equal(updated.preferredName, "Jori");
    assert.equal(updated.school, "Cedar Grove School");
    assert.equal(updated.grade, "2nd grade");
    assert.equal(updated.pronouns, "they/them");
    assert.equal(updated.childLedId, child.childLedId);

    const clearedResponse = await update({
      ...completeProfile,
      preferredName: "",
      pronouns: null,
      dateOfBirth: null,
    });
    assert.equal(clearedResponse.status, 200);
    const cleared = (await clearedResponse.json()) as Record<string, unknown>;
    assert.equal(cleared.name, "Jordan Bennett");
    assert.equal(cleared.preferredName, "");
    assert.equal(cleared.pronouns, null);
    assert.equal(cleared.dateOfBirth, null);
    assert.equal(cleared.childLedId, child.childLedId);

    const sameNameInput = {
      name: "Taylor Morgan",
      firstName: "Taylor",
      lastName: "Morgan",
      school: "Cedar Grove School",
      grade: "2nd grade",
      communicationStyle: "Multimodal communicator",
      legalAuthorityConfirmed: true,
      childLedId: "CLID-FORCED",
    };
    const firstCreateResponse = await create(sameNameInput);
    const secondCreateResponse = await create(sameNameInput);
    assert.equal(firstCreateResponse.status, 201);
    assert.equal(secondCreateResponse.status, 201);
    const firstCreated = (await firstCreateResponse.json()) as Record<
      string,
      unknown
    >;
    const secondCreated = (await secondCreateResponse.json()) as Record<
      string,
      unknown
    >;
    assert.equal(typeof firstCreated.id, "number");
    assert.equal(typeof secondCreated.id, "number");
    createdChildIds.push(Number(firstCreated.id), Number(secondCreated.id));
    assert.match(String(firstCreated.childLedId), /^CLID-[A-Z0-9]{6}$/);
    assert.match(String(secondCreated.childLedId), /^CLID-[A-Z0-9]{6}$/);
    assert.notEqual(firstCreated.childLedId, secondCreated.childLedId);
    assert.notEqual(firstCreated.childLedId, sameNameInput.childLedId);

    await assert.rejects(
      db.insert(childProfilesTable).values({
        childLedId: child.childLedId,
        organizationId: organization.id,
        displayName: "Duplicate identifier",
      }),
      (error: unknown) => {
        const databaseError = error as {
          code?: string;
          cause?: { code?: string; constraint?: string };
        };
        const constraintError = databaseError.cause ?? databaseError;
        return (
          constraintError.code === "23505" &&
          constraintError.constraint ===
            "child_profiles_child_led_id_lower_unique"
        );
      },
    );

    const [persisted] = await db
      .select()
      .from(childProfilesTable)
      .where(eq(childProfilesTable.id, child.id));
    assert.equal(persisted?.id, child.id);
    assert.equal(persisted?.organizationId, organization.id);
    const [persistedGestalt] = await db
      .select()
      .from(clinicalGestaltsTable)
      .where(eq(clinicalGestaltsTable.id, gestalt.id));
    assert.equal(persistedGestalt?.id, gestalt.id);
    assert.equal(persistedGestalt?.childId, child.id);

    const audits = await db
      .select()
      .from(securityAuditLogsTable)
      .where(
        and(
          eq(securityAuditLogsTable.userId, clinicianId),
          eq(securityAuditLogsTable.action, "CHILD_PROFILE_UPDATED"),
          eq(securityAuditLogsTable.childId, child.id),
        ),
      );
    assert.equal(audits.length, 2);
    assert.equal(audits[0]?.actorName, "Profile Clinician");
    assert.ok(audits[0]?.occurredAt instanceof Date);
    assert.match(String(audits[0]?.metadata.changedFields), /firstName/);
    assert.match(String(audits[1]?.metadata.changedFields), /preferredName/);
  } finally {
    server.close();
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, clinicianId));
    await db
      .delete(clinicalGestaltsTable)
      .where(eq(clinicalGestaltsTable.id, gestalt.id));
    const allChildIds = [child.id, ...createdChildIds];
    await db
      .delete(childProfileConsentRecordsTable)
      .where(inArray(childProfileConsentRecordsTable.childId, allChildIds));
    await db
      .delete(childCareTeamMembershipsTable)
      .where(inArray(childCareTeamMembershipsTable.childId, allChildIds));
    await db
      .delete(childProfilesTable)
      .where(inArray(childProfilesTable.id, allChildIds));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.organizationId, organization.id));
    await db.delete(usersTable).where(eq(usersTable.id, clinicianId));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, otherOrganization.id));
  }
});
