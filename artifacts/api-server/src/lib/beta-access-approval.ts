import { clerkClient } from "@clerk/express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  organizationMembershipsTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";
import { runtimeConfig } from "./runtime-config";

export type ExistingSlpApplicant = {
  userId: string;
  organizationId: number;
  membershipId: number;
  accountStatus: string;
  onboardingCompletedAt: Date | null;
};

export type BetaApplicantIdentity =
  | { kind: "new" }
  | { kind: "existing_slp"; slp: ExistingSlpApplicant }
  | { kind: "review_required"; reason: string };

const roleLabel = (role: string) => {
  switch (role.trim().toLowerCase()) {
    case "parent":
      return "Parent";
    case "teacher":
      return "Teacher";
    case "admin":
      return "Administrator";
    case "clinician":
      return "SLP";
    default:
      return role || "another";
  }
};

const exactClerkUserIds = async (email: string) => {
  if (!runtimeConfig.clerkInvitations.enabled) return new Set<string>();
  const users = await clerkClient.users.getUserList({
    emailAddress: [email],
    limit: 10,
  });
  return new Set(
    users.data
      .filter((user) =>
        user.emailAddresses.some(
          (entry) => entry.emailAddress.trim().toLowerCase() === email,
        ),
      )
      .map((user) => user.id),
  );
};

export const normalizeBetaApplicantEmail = (email: string) =>
  email.trim().toLowerCase();

/**
 * Classifies an applicant without changing roles. Existing non-Clerk or
 * conflicting-role identities always require an explicit admin review.
 */
export const resolveBetaApplicantIdentity = async (
  applicantEmail: string,
): Promise<BetaApplicantIdentity> => {
  const email = normalizeBetaApplicantEmail(applicantEmail);
  const [rows, clerkUserIds] = await Promise.all([
    db
      .select({
        userId: usersTable.id,
        identityProvider: usersTable.identityProvider,
        providerSubject: usersTable.providerSubject,
        userDisabledAt: usersTable.disabledAt,
        membershipId: organizationMembershipsTable.id,
        organizationId: organizationMembershipsTable.organizationId,
        role: organizationMembershipsTable.role,
        membershipActive: organizationMembershipsTable.active,
        accountStatus: organizationMembershipsTable.accountStatus,
        onboardingCompletedAt:
          organizationMembershipsTable.onboardingCompletedAt,
        membershipUpdatedAt: organizationMembershipsTable.updatedAt,
        organizationArchivedAt: organizationsTable.archivedAt,
        organizationDisabledAt: organizationsTable.disabledAt,
      })
      .from(usersTable)
      .leftJoin(
        organizationMembershipsTable,
        eq(organizationMembershipsTable.userId, usersTable.id),
      )
      .leftJoin(
        organizationsTable,
        eq(organizationsTable.id, organizationMembershipsTable.organizationId),
      )
      .where(
        and(
          sql`lower(${usersTable.email}) = ${email}`,
          isNull(usersTable.archivedAt),
        ),
      )
      .orderBy(
        desc(organizationMembershipsTable.active),
        desc(organizationMembershipsTable.updatedAt),
      ),
    exactClerkUserIds(email),
  ]);

  const userIds = new Set(rows.map((row) => row.userId));
  if (userIds.size > 1 || clerkUserIds.size > 1) {
    return {
      kind: "review_required",
      reason:
        "This email matches multiple account records. Review required before approval can continue.",
    };
  }
  if (!rows.length) {
    return clerkUserIds.size
      ? {
          kind: "review_required",
          reason:
            "This email already has a Clerk account without ChildLed SLP access. Review required before approval can continue.",
        }
      : { kind: "new" };
  }

  const user = rows[0]!;
  if (user.userDisabledAt) {
    return {
      kind: "review_required",
      reason:
        "This ChildLed account is disabled. Review required before approval can continue.",
    };
  }
  if (user.identityProvider !== "clerk") {
    return {
      kind: "review_required",
      reason:
        "This email is associated with a development or administrator-managed account. Review required before approval can continue.",
    };
  }
  if (
    runtimeConfig.clerkInvitations.enabled &&
    !clerkUserIds.has(user.providerSubject)
  ) {
    return {
      kind: "review_required",
      reason:
        "The Clerk and ChildLed identity records for this email do not match. Review required before approval can continue.",
    };
  }

  const memberships = rows.filter(
    (row) => row.membershipId && row.organizationId && row.role,
  );
  if (!memberships.length) {
    return {
      kind: "review_required",
      reason:
        "This email already has a ChildLed account without an assigned role. Review required before approval can continue.",
    };
  }
  const conflictingRole = memberships.find(
    (membership) => membership.role!.trim().toLowerCase() !== "clinician",
  );
  if (conflictingRole) {
    return {
      kind: "review_required",
      reason: `This email is already associated with a ${roleLabel(conflictingRole.role!)} account. Review required before approval can continue.`,
    };
  }

  const eligible = memberships.find(
    (membership) =>
      !membership.organizationArchivedAt && !membership.organizationDisabledAt,
  );
  if (!eligible) {
    return {
      kind: "review_required",
      reason:
        "This SLP account belongs to a disabled or archived workspace. Review required before approval can continue.",
    };
  }
  return {
    kind: "existing_slp",
    slp: {
      userId: eligible.userId,
      organizationId: eligible.organizationId!,
      membershipId: eligible.membershipId!,
      accountStatus: eligible.accountStatus!,
      onboardingCompletedAt: eligible.onboardingCompletedAt,
    },
  };
};
