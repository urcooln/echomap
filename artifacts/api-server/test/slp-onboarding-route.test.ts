import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  betaControlsTable,
  careTeamInvitationsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  slpProfilesTable,
  userAgreementAcceptancesTable,
  usersTable,
} from "@workspace/db";
import { provisionClerkInvitation } from "../src/lib/clerk-invitation-provisioning";
import { hashInvitationToken } from "../src/lib/invitation-security";
import { SLP_AGREEMENTS } from "../src/lib/slp-onboarding";
import { completeSlpOnboardingAccount } from "../src/lib/slp-onboarding-account";

test.after(async () => {
  await pool.end();
});

test("an invited SLP is restricted until profile and agreements activate the membership", async () => {
  const suffix = randomUUID();
  const clerkUserId = `user_slp_onboarding_${suffix}`;
  const email = `slp-${suffix}@example.test`;
  const token = `slp-onboarding-token-${suffix}`;
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
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `slp-onboarding-${suffix}`,
      name: "SLP Onboarding Test",
      betaApprovedAt: new Date(),
    })
    .returning();
  assert.ok(organization);
  const [invitation] = await db
    .insert(careTeamInvitationsTable)
    .values({
      organizationId: organization.id,
      invitedEmail: email,
      invitedRole: "clinician",
      invitedByUserId: `test-inviter-${suffix}`,
      clerkInvitationId: `invitation_${suffix}`,
      tokenHash: hashInvitationToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      accessScope: "organization",
      childScope: [],
    })
    .returning();
  assert.ok(invitation);

  const clerkUser = {
    id: clerkUserId,
    fullName: "Invited Clinician",
    firstName: "Invited",
    lastName: "Clinician",
    username: null,
    publicMetadata: {},
    emailAddresses: [
      { emailAddress: email, verification: { status: "verified" } },
    ],
  };
  const userId = `clerk_${clerkUserId}`;
  try {
    const provisioned = await provisionClerkInvitation({
      clerkUser,
      allowVerifiedEmailLookup: true,
    });
    assert.equal(provisioned?.membershipRole, "clinician");
    assert.equal(provisioned?.onboardingRequired, true);
    const [pendingMembership] = await db
      .select()
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, organization.id),
          eq(organizationMembershipsTable.userId, userId),
        ),
      )
      .limit(1);
    assert.equal(pendingMembership?.accountStatus, "onboarding");
    assert.equal(pendingMembership?.onboardingCompletedAt, null);

    await completeSlpOnboardingAccount({
      organizationId: organization.id,
      userId,
      clerkUserId,
      profile: {
        firstName: "Invited",
        lastName: "Clinician",
        professionalTitle: "Speech-Language Pathologist",
        school: "Pilot School",
        schoolDistrict: "Pilot District",
        licensureState: "Ohio",
        licenseNumber: "SELF-REPORTED-123",
        licenseExpirationDate: null,
        ashaCccSlpNumber: null,
      },
    });

    const [activeMembership] = await db
      .select()
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, organization.id),
          eq(organizationMembershipsTable.userId, userId),
        ),
      )
      .limit(1);
    assert.equal(activeMembership?.accountStatus, "active");
    assert.ok(activeMembership?.onboardingCompletedAt);
    const [profile] = await db
      .select()
      .from(slpProfilesTable)
      .where(eq(slpProfilesTable.userId, userId));
    assert.equal(profile?.licenseVerificationStatus, "unverified");
    const acceptances = await db
      .select()
      .from(userAgreementAcceptancesTable)
      .where(eq(userAgreementAcceptancesTable.userId, userId));
    assert.equal(acceptances.length, SLP_AGREEMENTS.length);
    assert.ok(acceptances.every((item) => item.clerkUserId === clerkUserId));
  } finally {
    await db
      .delete(userAgreementAcceptancesTable)
      .where(eq(userAgreementAcceptancesTable.userId, userId));
    await db
      .delete(slpProfilesTable)
      .where(eq(slpProfilesTable.userId, userId));
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, userId));
    await db
      .delete(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.id, invitation.id));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
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
