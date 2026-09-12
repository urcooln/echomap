import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  aacProfilesTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalGestaltsTable,
  communicationGoalsTable,
  communicationPassportsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  sharedChildProfileEntriesTable,
  sharedChildProfileHistoryTable,
  usersTable,
} from "@workspace/db";
import type {
  CareTeamRole,
  ResolvedCareTeamActor,
} from "../src/lib/auth-context";
import router from "../src/routes/childled";

const actorFor = (
  userId: string,
  role: CareTeamRole,
  organizationId: number,
  childIds: number[],
): ResolvedCareTeamActor => ({
  userId,
  author: `${role} Passport Tester`,
  role,
  childIds,
  isAdmin: false,
  organizationId,
  expiresAt: Date.now() + 60_000,
});

test.after(async () => {
  await pool.end();
});

test("communication passports are SLP-controlled, child-scoped, and share-safe", async () => {
  const suffix = randomUUID();
  const userIds = {
    slp: `passport-slp-${suffix}`,
    parent: `passport-parent-${suffix}`,
    teacher: `passport-teacher-${suffix}`,
    outsider: `passport-outsider-${suffix}`,
  };
  const [organization] = await db
    .insert(organizationsTable)
    .values({ slug: `passport-${suffix}`, name: "Passport route test" })
    .returning();
  assert.ok(organization);
  await db.insert(usersTable).values(
    Object.entries(userIds).map(([role, id]) => ({
      id,
      identityProvider: "communication-passport-test",
      providerSubject: id,
      displayName: `${role} passport tester`,
    })),
  );
  await db.insert(organizationMembershipsTable).values([
    { organizationId: organization.id, userId: userIds.slp, role: "clinician" },
    { organizationId: organization.id, userId: userIds.parent, role: "parent" },
    {
      organizationId: organization.id,
      userId: userIds.teacher,
      role: "teacher",
    },
    {
      organizationId: organization.id,
      userId: userIds.outsider,
      role: "teacher",
    },
  ]);
  const [child] = await db
    .insert(childProfilesTable)
    .values({
      organizationId: organization.id,
      displayName: "Alex Morgan",
      firstName: "Alexander",
      lastName: "Morgan",
      preferredName: "Alex",
      communicationStyle: "Gestalt language processor",
      profileDetails: {
        strengths: ["Connects through shared songs"],
        specialInterests: ["Trains"],
        sensorySupports: ["Allow extra processing time"],
        sensoryChallenges: ["Rapid questions"],
        regulationNotes: "Offer a quiet pause and keep language simple.",
        glpNotes: "PRIVATE CLINICAL NOTE - NEVER SHARE",
      },
    })
    .returning();
  assert.ok(child);
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: child.id, userId: userIds.slp, role: "clinician" },
    { childId: child.id, userId: userIds.parent, role: "parent" },
    { childId: child.id, userId: userIds.teacher, role: "teacher" },
  ]);
  await db.insert(clinicalGestaltsTable).values([
    {
      organizationId: organization.id,
      childId: child.id,
      phrase: "All aboard",
      normalizedPhrase: "all aboard",
      meaning: "Wants to begin",
      communicationFunction: "Request",
      contexts: ["School"],
      emotionalState: "Regulated",
      source: "Clinician reviewed",
      createdByUserId: userIds.slp,
    },
    {
      organizationId: organization.id,
      childId: child.id,
      phrase: "Private draft phrase",
      normalizedPhrase: "private draft phrase",
      meaning: "Awaiting clinician review",
      communicationFunction: "Not yet reviewed",
      contexts: [],
      emotionalState: "Not documented",
      source: "Parent observation - clinician review pending",
      createdByUserId: userIds.slp,
    },
  ]);
  await db.insert(aacProfilesTable).values({
    organizationId: organization.id,
    childId: child.id,
    communicationModalities: ["aac", "gestures"],
    aacUserStatus: "yes",
    deviceVendorId: "other",
    deviceVendorCustomLabel: "School tablet",
    vocabularySystemId: "other",
    vocabularySystemCustomLabel: "Core vocabulary",
    accessMethodId: "other",
    accessMethodCustomLabel: "Direct touch",
    notes: "PRIVATE AAC CLINICAL NOTE - NEVER SHARE",
    confirmedAt: new Date(),
    confirmedByUserId: userIds.slp,
    confirmedByName: "SLP Passport Tester",
    confirmedByRole: "SLP",
    updatedByUserId: userIds.slp,
    updatedByName: "SLP Passport Tester",
    updatedByRole: "SLP",
  });
  await db.insert(communicationGoalsTable).values([
    {
      organizationId: organization.id,
      childId: child.id,
      title: "Request a preferred activity",
      goalArea: "Expressive communication",
      description: "Use available communication to request.",
      startDate: "2026-09-01",
      createdByUserId: userIds.slp,
      updatedByUserId: userIds.slp,
    },
    {
      organizationId: organization.id,
      childId: child.id,
      title: "Archived private goal",
      goalArea: "Archived",
      description: "Should not appear.",
      status: "archived",
      startDate: "2026-01-01",
      archivedAt: new Date(),
      archivedByUserId: userIds.slp,
      createdByUserId: userIds.slp,
      updatedByUserId: userIds.slp,
    },
  ]);

  let actor = actorFor(userIds.slp, "SLP", organization.id, [child.id]);
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
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}${path}`, init);
    return {
      status: response.status,
      body: (await response.json()) as Record<string, any>,
    };
  };
  const json = (method: string, path: string, body: Record<string, unknown>) =>
    request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    const empty = await request(`/communication-passport?childId=${child.id}`);
    assert.equal(empty.status, 200);
    assert.equal(empty.body.exists, false);
    assert.equal(empty.body.canEdit, true);
    assert.equal(empty.body.content, null);

    actor = actorFor(userIds.parent, "Parent", organization.id, [child.id]);
    assert.equal(
      (
        await json("POST", "/communication-passport/generate", {
          childId: child.id,
        })
      ).status,
      403,
    );

    actor = actorFor(userIds.slp, "SLP", organization.id, [child.id]);
    const generated = await json("POST", "/communication-passport/generate", {
      childId: child.id,
    });
    assert.equal(generated.status, 200);
    assert.equal(generated.body.content.childName, "Alexander M.");
    assert.equal(generated.body.content.preferredName, "Alex");
    assert.equal(generated.body.content.commonPhrases.length, 1);
    assert.equal(generated.body.content.commonPhrases[0].phrase, "All aboard");
    assert.ok(generated.body.content.interests.includes("Trains"));
    assert.ok(
      generated.body.content.currentGoals.includes(
        "Request a preferred activity",
      ),
    );
    const generatedJson = JSON.stringify(generated.body);
    assert.ok(!generatedJson.includes("PRIVATE CLINICAL NOTE"));
    assert.ok(!generatedJson.includes("PRIVATE AAC CLINICAL NOTE"));
    assert.ok(!generatedJson.includes("Private draft phrase"));
    assert.ok(!generatedJson.includes("Archived private goal"));

    const content = {
      ...generated.body.content,
      childName: "Alexander Morgan",
      preferredName: "Alex Morgan",
      aboutMe: "Alex connects through movement, songs, and shared play.",
    };
    const saved = await json("PUT", "/communication-passport", {
      childId: child.id,
      templateKey: "general",
      language: "en",
      content,
      version: null,
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.exists, true);
    assert.equal(saved.body.version, 1);
    assert.equal(saved.body.content.childName, "Alexander M.");
    assert.equal(saved.body.content.preferredName, "Alex");

    actor = actorFor(userIds.teacher, "Teacher", organization.id, [child.id]);
    const teacherView = await request(
      `/communication-passport?childId=${child.id}`,
    );
    assert.equal(teacherView.status, 200);
    assert.equal(teacherView.body.canEdit, false);
    assert.equal(teacherView.body.content.childName, "Alexander M.");
    assert.equal(teacherView.body.content.aboutMe, content.aboutMe);
    assert.equal(
      (
        await json("PUT", "/communication-passport", {
          childId: child.id,
          templateKey: "general",
          language: "en",
          content,
          version: 1,
        })
      ).status,
      403,
    );

    actor = actorFor(userIds.outsider, "Teacher", organization.id, []);
    assert.equal(
      (await request(`/communication-passport?childId=${child.id}`)).status,
      403,
    );

    actor = actorFor(userIds.slp, "SLP", organization.id, [child.id]);
    const stale = await json("PUT", "/communication-passport", {
      childId: child.id,
      templateKey: "general",
      language: "en",
      content,
      version: null,
    });
    assert.equal(stale.status, 409);
    const updated = await json("PUT", "/communication-passport", {
      childId: child.id,
      templateKey: "general",
      language: "en",
      content: { ...content, additionalInformation: "Use natural language." },
      version: 1,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.version, 2);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db
      .delete(communicationPassportsTable)
      .where(eq(communicationPassportsTable.childId, child.id));
    await db
      .delete(communicationGoalsTable)
      .where(eq(communicationGoalsTable.childId, child.id));
    await db
      .delete(aacProfilesTable)
      .where(eq(aacProfilesTable.childId, child.id));
    await db
      .delete(clinicalGestaltsTable)
      .where(eq(clinicalGestaltsTable.childId, child.id));
    await db
      .delete(sharedChildProfileHistoryTable)
      .where(eq(sharedChildProfileHistoryTable.childId, child.id));
    await db
      .delete(sharedChildProfileEntriesTable)
      .where(eq(sharedChildProfileEntriesTable.childId, child.id));
    await db
      .delete(securityAuditLogsTable)
      .where(inArray(securityAuditLogsTable.userId, Object.values(userIds)));
    await db
      .delete(childCareTeamMembershipsTable)
      .where(eq(childCareTeamMembershipsTable.childId, child.id));
    await db
      .delete(childProfilesTable)
      .where(eq(childProfilesTable.id, child.id));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.organizationId, organization.id));
    await db
      .delete(usersTable)
      .where(inArray(usersTable.id, Object.values(userIds)));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
  }
});
