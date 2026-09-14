import assert from "node:assert/strict";
import test from "node:test";
import {
  clerkInvitationReferenceFromMetadata,
  invitationRoleMarker,
} from "../src/lib/clerk-invitation-metadata";
import {
  hasEveryCurrentSlpAgreement,
  invitationRequiresRoleOnboarding,
  SLP_AGREEMENTS,
} from "../src/lib/slp-onboarding";

test("Clerk invitation metadata carries a server-issued reference and normalized role", () => {
  assert.equal(invitationRoleMarker("clinician"), "slp");
  assert.deepEqual(
    clerkInvitationReferenceFromMetadata({
      childledInvitationId: "42",
      childledInvitationRole: "SLP",
    }),
    { invitationId: 42, roleMarker: "slp" },
  );
  assert.equal(
    clerkInvitationReferenceFromMetadata({ childledInvitationRole: "slp" }),
    null,
  );
});

test("SLP activation requires every current agreement at its exact version", () => {
  const all = SLP_AGREEMENTS.map(({ type, version }) => ({ type, version }));
  assert.equal(hasEveryCurrentSlpAgreement(all), true);
  assert.equal(hasEveryCurrentSlpAgreement(all.slice(1)), false);
  assert.equal(
    hasEveryCurrentSlpAgreement(
      all.map((agreement, index) =>
        index === 0 ? { ...agreement, version: "old" } : agreement,
      ),
    ),
    false,
  );
});

test("an invited role requires setup unless onboarding for that same role is already complete", () => {
  assert.equal(
    invitationRequiresRoleOnboarding({ membershipRole: "clinician" }),
    true,
  );
  assert.equal(
    invitationRequiresRoleOnboarding({
      membershipRole: "clinician",
      existingMembership: {
        role: "teacher",
        accountStatus: "active",
        onboardingCompletedAt: new Date(),
      },
    }),
    true,
  );
  assert.equal(
    invitationRequiresRoleOnboarding({
      membershipRole: "clinician",
      existingMembership: {
        role: "clinician",
        accountStatus: "onboarding",
        onboardingCompletedAt: null,
      },
    }),
    true,
  );
  assert.equal(
    invitationRequiresRoleOnboarding({
      membershipRole: "clinician",
      existingMembership: {
        role: "clinician",
        accountStatus: "active",
        onboardingCompletedAt: new Date(),
      },
    }),
    false,
  );
  assert.equal(
    invitationRequiresRoleOnboarding({ membershipRole: "teacher" }),
    true,
  );
  assert.equal(
    invitationRequiresRoleOnboarding({
      membershipRole: "parent",
      existingMembership: {
        role: "parent",
        accountStatus: "active",
        onboardingCompletedAt: new Date(),
      },
    }),
    false,
  );
});
