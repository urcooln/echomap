import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfileConsentRecordsTable,
  childProfilesTable,
  db,
  organizationsTable,
  pool,
  schoolDistrictsTable,
  securityAuditLogsTable,
  slpProfilesTable,
  teacherDistrictMembershipsTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";
import { ROLE_PREVIEW_COOKIE } from "../src/lib/role-preview";

test.after(async () => pool.end());

test("district management is owner-only and roster follows relational assignments", async () => {
  const suffix = randomUUID();
  const slpId = `district-slp-${suffix}`;
  const teacherId = `district-teacher-${suffix}`;
  const ownerId = `district-owner-${suffix}`;
  const [organization] = await db
    .insert(organizationsTable)
    .values({ slug: `district-test-${suffix}`, name: "District Test" })
    .returning();
  assert.ok(organization);
  await db.insert(usersTable).values([
    {
      id: slpId,
      identityProvider: "district-test",
      providerSubject: slpId,
      displayName: "Test SLP",
    },
    {
      id: teacherId,
      identityProvider: "district-test",
      providerSubject: teacherId,
      displayName: "Test Teacher",
    },
    {
      id: ownerId,
      identityProvider: "district-test",
      providerSubject: ownerId,
      displayName: "Test Owner",
    },
  ]);
  const slpActor: ResolvedCareTeamActor = {
    userId: slpId,
    author: "Test SLP",
    role: "SLP",
    childIds: [],
    isAdmin: false,
    isSuperAdmin: false,
    organizationId: organization.id,
    onboardingComplete: true,
    expiresAt: Date.now() + 60_000,
  };
  const ownerActor: ResolvedCareTeamActor = {
    ...slpActor,
    userId: ownerId,
    author: "Test Owner",
    role: "Administrator",
    isAdmin: true,
    isSuperAdmin: true,
  };
  let actor = slpActor;
  let previewRole: "SLP" | "Teacher" | "Parent" | "Administrator" | undefined;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = actor;
    req.signedCookies = previewRole
      ? { [ROLE_PREVIEW_COOKIE]: previewRole }
      : {};
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/admin/school-districts`;
  let districtId: number | undefined;
  let childId: number | undefined;
  let legacyChildId: number | undefined;
  try {
    for (const role of ["SLP", "Teacher", "Parent", "Administrator"] as const) {
      actor = { ...slpActor, role, isAdmin: role === "Administrator" };
      assert.equal((await fetch(endpoint)).status, 403, role);
      assert.equal(
        (
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Unauthorized" }),
          })
        ).status,
        403,
        role,
      );
    }
    actor = {
      ...ownerActor,
      isDevelopmentDemo: true,
      developmentDemoPersonas: {
        SLP: {
          userId: slpId,
          author: "Test SLP",
          role: "SLP",
          childIds: [],
          isAdmin: false,
        },
        Teacher: {
          userId: teacherId,
          author: "Test Teacher",
          role: "Teacher",
          childIds: [],
          isAdmin: false,
        },
        Parent: {
          userId: teacherId,
          author: "Test Parent",
          role: "Parent",
          childIds: [],
          isAdmin: false,
        },
        Administrator: {
          userId: ownerId,
          author: "Test Owner",
          role: "Administrator",
          childIds: [],
          isAdmin: true,
        },
      },
    };
    for (const role of ["SLP", "Teacher", "Parent"] as const) {
      previewRole = role;
      assert.equal((await fetch(endpoint)).status, 403, `${role} preview`);
    }
    previewRole = "Administrator";
    assert.equal((await fetch(endpoint)).status, 200, "Admin preview");
    previewRole = undefined;
    actor = ownerActor;
    const create = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `District ${suffix}` }),
    });
    assert.equal(create.status, 201);
    const district = (await create.json()) as { id: number; active: boolean };
    districtId = district.id;
    assert.equal(district.active, true);
    assert.equal(
      (
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `district ${suffix}` }),
        })
      ).status,
      409,
    );

    const [legacyProfile] = await db
      .insert(slpProfilesTable)
      .values({
        organizationId: organization.id,
        userId: slpId,
        firstName: "Test",
        lastName: "SLP",
        professionalTitle: "SLP",
        school: "Pilot",
        schoolDistrict: `District ${suffix}`,
        licensureState: "NY",
        licenseNumber: "TEST",
      })
      .returning();
    assert.ok(legacyProfile);
    const [legacyChild] = await db
      .insert(childProfilesTable)
      .values({
        organizationId: organization.id,
        displayName: "Existing Child",
      })
      .returning();
    assert.ok(legacyChild);
    legacyChildId = legacyChild.id;
    await db
      .insert(childCareTeamMembershipsTable)
      .values({ childId: legacyChildId, userId: slpId, role: "clinician" });
    const unassigned = await fetch(
      `http://127.0.0.1:${address.port}/admin/unassigned-slp-districts`,
    );
    assert.equal(unassigned.status, 200);
    assert.ok(
      ((await unassigned.json()) as Array<{ profileId: number }>).some(
        (profile) => profile.profileId === legacyProfile.id,
      ),
    );
    const assignEndpoint = `http://127.0.0.1:${address.port}/admin/slp-profiles/${legacyProfile.id}/district`;
    actor = slpActor;
    assert.equal(
      (
        await fetch(assignEndpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ districtId }),
        })
      ).status,
      403,
    );
    actor = ownerActor;
    const assign = await fetch(assignEndpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ districtId }),
    });
    assert.equal(assign.status, 200);
    const [assignedProfile] = await db
      .select()
      .from(slpProfilesTable)
      .where(eq(slpProfilesTable.id, legacyProfile.id));
    assert.equal(assignedProfile?.districtId, districtId);
    assert.equal(assignedProfile?.schoolDistrict, `District ${suffix}`);
    const [assignedLegacyChild] = await db
      .select()
      .from(childProfilesTable)
      .where(eq(childProfilesTable.id, legacyChildId));
    assert.equal(assignedLegacyChild?.districtId, districtId);
    actor = slpActor;
    const createChild = await fetch(
      `http://127.0.0.1:${address.port}/children`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Child",
          school: "Pilot",
          grade: "2nd",
          communicationStyle: "Multimodal",
          legalAuthorityConfirmed: true,
        }),
      },
    );
    assert.equal(createChild.status, 201);
    const child = (await createChild.json()) as { id: number };
    childId = child.id;
    const [savedChild] = await db
      .select()
      .from(childProfilesTable)
      .where(eq(childProfilesTable.id, childId));
    assert.equal(savedChild?.districtId, districtId);
    await db
      .insert(childCareTeamMembershipsTable)
      .values({ childId, userId: teacherId, role: "teacher" });
    const teacherAffiliations = await db
      .select()
      .from(teacherDistrictMembershipsTable)
      .where(eq(teacherDistrictMembershipsTable.teacherUserId, teacherId));
    assert.deepEqual(
      teacherAffiliations.map((row) => row.districtId),
      [districtId],
    );
    actor = ownerActor;
    const detail = await fetch(`${endpoint}/${districtId}`);
    assert.equal(detail.status, 200);
    const roster = (await detail.json()) as {
      slps: unknown[];
      teachers: unknown[];
      students: unknown[];
    };
    assert.equal(roster.slps.length, 1);
    assert.equal(roster.teachers.length, 1);
    assert.equal(roster.students.length, 2);
    const list = await fetch(endpoint);
    assert.equal(list.status, 200);
    const summaries = (await list.json()) as Array<{
      id: number;
      slpCount: number;
      teacherCount: number;
      studentCount: number;
    }>;
    assert.equal(summaries.find((item) => item.id === districtId)?.slpCount, 1);
    assert.equal(
      summaries.find((item) => item.id === districtId)?.teacherCount,
      1,
    );
    assert.equal(
      summaries.find((item) => item.id === districtId)?.studentCount,
      2,
    );
    const update = await fetch(`${endpoint}/${districtId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Renamed ${suffix}`, active: false }),
    });
    assert.equal(update.status, 200);
    const [renamed] = await db
      .select()
      .from(schoolDistrictsTable)
      .where(eq(schoolDistrictsTable.id, districtId));
    assert.equal(renamed?.name, `Renamed ${suffix}`);
    assert.equal(renamed?.active, false);
    assert.equal(
      (await fetch(`${endpoint}/${districtId}`, { method: "DELETE" })).status,
      404,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (childId)
      await db
        .delete(childProfileConsentRecordsTable)
        .where(eq(childProfileConsentRecordsTable.childId, childId));
    if (childId)
      await db
        .delete(childCareTeamMembershipsTable)
        .where(eq(childCareTeamMembershipsTable.childId, childId));
    if (legacyChildId)
      await db
        .delete(childCareTeamMembershipsTable)
        .where(eq(childCareTeamMembershipsTable.childId, legacyChildId));
    if (childId)
      await db
        .delete(childProfilesTable)
        .where(eq(childProfilesTable.id, childId));
    if (legacyChildId)
      await db
        .delete(childProfilesTable)
        .where(eq(childProfilesTable.id, legacyChildId));
    await db
      .delete(teacherDistrictMembershipsTable)
      .where(eq(teacherDistrictMembershipsTable.teacherUserId, teacherId));
    await db.delete(slpProfilesTable).where(eq(slpProfilesTable.userId, slpId));
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, ownerId));
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, slpId));
    if (districtId)
      await db
        .delete(schoolDistrictsTable)
        .where(eq(schoolDistrictsTable.id, districtId));
    for (const id of [slpId, teacherId, ownerId])
      await db.delete(usersTable).where(eq(usersTable.id, id));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
  }
});
