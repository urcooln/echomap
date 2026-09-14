import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  usersTable,
} from "@workspace/db";
import { completeCareTeamOnboardingAccount } from "../src/lib/care-team-onboarding-account";

test.after(async () => {
  await pool.end();
});

test("care-team onboarding gives the invited adult an identity without changing child access", async () => {
  const suffix = randomUUID();
  const userId = `clerk_parent_onboarding_${suffix}`;
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `parent-onboarding-${suffix}`,
      name: "Parent Onboarding Test",
      betaApprovedAt: new Date(),
    })
    .returning();
  assert.ok(organization);

  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "clerk",
    providerSubject: `user_${suffix}`,
    displayName: "Invited Parent",
    email: `parent-${suffix}@example.test`,
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "parent",
    accountStatus: "onboarding",
    onboardingCompletedAt: null,
  });
  const [child] = await db
    .insert(childProfilesTable)
    .values({
      organizationId: organization.id,
      displayName: "Assigned Student",
    })
    .returning();
  assert.ok(child);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: child.id,
    userId,
    role: "parent",
  });

  try {
    await completeCareTeamOnboardingAccount({
      organizationId: organization.id,
      userId,
      role: "parent",
      firstName: "  Jordan ",
      lastName: " Rivera  ",
    });

    const [membership] = await db
      .select()
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, organization.id),
          eq(organizationMembershipsTable.userId, userId),
        ),
      );
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    const assignments = await db
      .select()
      .from(childCareTeamMembershipsTable)
      .where(eq(childCareTeamMembershipsTable.userId, userId));

    assert.equal(membership?.accountStatus, "active");
    assert.ok(membership?.onboardingCompletedAt);
    assert.equal(user?.displayName, "Jordan Rivera");
    assert.deepEqual(
      assignments.map((item) => item.childId),
      [child.id],
    );
  } finally {
    await db
      .delete(childCareTeamMembershipsTable)
      .where(eq(childCareTeamMembershipsTable.userId, userId));
    await db
      .delete(childProfilesTable)
      .where(eq(childProfilesTable.id, child.id));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
  }
});
