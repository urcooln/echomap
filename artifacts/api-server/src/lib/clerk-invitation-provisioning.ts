import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  betaControlsTable,
  careTeamInvitationsTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";
import {
  acceptedInvitationChildScope,
  hashInvitationToken,
} from "./invitation-security";
import type { ClerkInvitationReference } from "./clerk-invitation-metadata";
import { invitationRequiresSlpOnboarding } from "./slp-onboarding";

type ClerkInvitationUser = {
  id: string;
  fullName: string | null;
  username: string | null;
  publicMetadata: Record<string, unknown>;
  emailAddresses: Array<{
    emailAddress: string;
    verification?: { status?: string | null } | null;
  }>;
};

const invitationRole = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "clinician" || normalized === "slp") {
    return { membershipRole: "clinician" as const, marker: "slp" };
  }
  if (normalized === "parent") {
    return { membershipRole: "parent" as const, marker: "parent" };
  }
  if (normalized === "teacher") {
    return { membershipRole: "teacher" as const, marker: "teacher" };
  }
  return null;
};

export const provisionClerkInvitation = async ({
  clerkUser,
  token,
  reference,
  allowVerifiedEmailLookup = false,
}: {
  clerkUser: ClerkInvitationUser;
  token?: string;
  reference?: ClerkInvitationReference;
  allowVerifiedEmailLookup?: boolean;
}) => {
  const verified = clerkUser.emailAddresses.find(
    (entry) =>
      entry.verification?.status === "verified" && entry.emailAddress.trim(),
  );
  if (!verified) return null;
  const email = verified.emailAddress.trim().toLowerCase();
  const tokenHash = token ? hashInvitationToken(token) : null;
  const acceptedAt = new Date();
  let resolvedReference = reference;

  if (!tokenHash && !resolvedReference && allowVerifiedEmailLookup) {
    const pendingInvitations = await db
      .select({
        id: careTeamInvitationsTable.id,
      })
      .from(careTeamInvitationsTable)
      .where(
        and(
          sql`lower(${careTeamInvitationsTable.invitedEmail}) = ${email}`,
          eq(careTeamInvitationsTable.status, "pending"),
          isNull(careTeamInvitationsTable.revokedAt),
          isNotNull(careTeamInvitationsTable.clerkInvitationId),
          gt(careTeamInvitationsTable.expiresAt, acceptedAt),
        ),
      )
      .limit(2);
    if (pendingInvitations.length !== 1) return null;
    resolvedReference = {
      invitationId: pendingInvitations[0]!.id,
      roleMarker: null,
    };
  }

  if (!tokenHash && !resolvedReference) return null;

  return db.transaction(async (tx) => {
    if (tokenHash) {
      await tx.execute(
        sql`SELECT id FROM care_team_invitations WHERE token_hash = ${tokenHash} FOR UPDATE`,
      );
    } else {
      await tx.execute(
        sql`SELECT id FROM care_team_invitations WHERE id = ${resolvedReference!.invitationId} FOR UPDATE`,
      );
    }

    const [invite] = await tx
      .select()
      .from(careTeamInvitationsTable)
      .where(
        tokenHash
          ? eq(careTeamInvitationsTable.tokenHash, tokenHash)
          : eq(careTeamInvitationsTable.id, resolvedReference!.invitationId),
      )
      .limit(1);
    if (
      !invite ||
      invite.revokedAt ||
      invite.invitedEmail.toLowerCase() !== email
    ) {
      return null;
    }

    const role = invitationRole(invite.invitedRole);
    if (
      !role ||
      (resolvedReference?.roleMarker &&
        resolvedReference.roleMarker !== role.marker)
    ) {
      return null;
    }

    if (invite.status === "accepted" && invite.acceptedByUserId) {
      const [acceptedUser] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, invite.acceptedByUserId),
            eq(usersTable.identityProvider, "clerk"),
            eq(usersTable.providerSubject, clerkUser.id),
            isNull(usersTable.archivedAt),
          ),
        )
        .limit(1);
      const [membership] = acceptedUser
        ? await tx
            .select()
            .from(organizationMembershipsTable)
            .where(
              and(
                eq(
                  organizationMembershipsTable.organizationId,
                  invite.organizationId,
                ),
                eq(organizationMembershipsTable.userId, acceptedUser.id),
                eq(organizationMembershipsTable.role, role.membershipRole),
                eq(organizationMembershipsTable.active, true),
              ),
            )
            .limit(1)
        : [];
      return acceptedUser && membership
        ? {
            invitation: invite,
            userId: acceptedUser.id,
            membershipRole: role.membershipRole,
            onboardingRequired: membership.accountStatus === "onboarding",
          }
        : null;
    }
    if (
      invite.status !== "pending" ||
      !invite.expiresAt ||
      invite.expiresAt <= acceptedAt
    ) {
      return null;
    }

    const [organization] = await tx
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, invite.organizationId))
      .limit(1)
      .for("update");
    if (
      !organization ||
      organization.disabledAt ||
      organization.archivedAt ||
      !organization.betaApprovedAt
    ) {
      return null;
    }
    const [controls] = await tx
      .select()
      .from(betaControlsTable)
      .where(eq(betaControlsTable.id, 1))
      .limit(1);
    if (!controls?.enabled) return null;

    const [existingUser] = await tx
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.identityProvider, "clerk"),
          eq(usersTable.providerSubject, clerkUser.id),
          isNull(usersTable.archivedAt),
        ),
      )
      .limit(1);
    if (existingUser?.disabledAt) return null;
    const userId = existingUser?.id ?? `clerk_${clerkUser.id}`;
    const displayName =
      clerkUser.fullName || clerkUser.username || verified.emailAddress;
    if (!existingUser) {
      await tx.insert(usersTable).values({
        id: userId,
        identityProvider: "clerk",
        providerSubject: clerkUser.id,
        displayName,
        email,
        betaApprovedAt: acceptedAt,
        betaCohort: organization.betaCohort,
      });
    } else {
      await tx
        .update(usersTable)
        .set({
          displayName,
          email,
          betaApprovedAt: acceptedAt,
          betaCohort: organization.betaCohort,
        })
        .where(eq(usersTable.id, userId));
    }

    const [existingMembership] = await tx
      .select()
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, organization.id),
          eq(organizationMembershipsTable.userId, userId),
        ),
      )
      .limit(1);
    const [activeCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, organization.id),
          eq(organizationMembershipsTable.active, true),
        ),
      );
    const membershipLimit =
      organization.betaUserLimit ??
      controls.defaultOrganizationUserLimit ??
      null;
    if (
      existingMembership?.active !== true &&
      membershipLimit !== null &&
      (activeCount?.count ?? 0) >= membershipLimit
    ) {
      return null;
    }

    const onboardingRequired = invitationRequiresSlpOnboarding({
      membershipRole: role.membershipRole,
      existingMembership,
    });
    await tx
      .insert(organizationMembershipsTable)
      .values({
        organizationId: organization.id,
        userId,
        role: role.membershipRole,
        active: true,
        accountStatus: onboardingRequired ? "onboarding" : "active",
        onboardingCompletedAt: onboardingRequired ? null : acceptedAt,
      })
      .onConflictDoUpdate({
        target: [
          organizationMembershipsTable.organizationId,
          organizationMembershipsTable.userId,
        ],
        set: {
          role: role.membershipRole,
          active: true,
          ...(onboardingRequired
            ? { accountStatus: "onboarding", onboardingCompletedAt: null }
            : {}),
        },
      });

    const scopedChildren = acceptedInvitationChildScope({
      membershipRole: role.membershipRole,
      accessScope: invite.accessScope,
      childScope: invite.childScope,
      childId: invite.childId,
    });
    if (!scopedChildren) return null;
    if (scopedChildren.length) {
      const validChildren = await tx
        .select({ id: childProfilesTable.id })
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.organizationId, organization.id),
            inArray(childProfilesTable.id, scopedChildren),
            isNull(childProfilesTable.archivedAt),
          ),
        );
      if (validChildren.length !== new Set(scopedChildren).size) return null;
    }
    for (const childId of scopedChildren) {
      await tx
        .insert(childCareTeamMembershipsTable)
        .values({
          childId,
          userId,
          role: role.membershipRole,
          active: true,
        })
        .onConflictDoUpdate({
          target: [
            childCareTeamMembershipsTable.childId,
            childCareTeamMembershipsTable.userId,
          ],
          set: { role: role.membershipRole, active: true },
        });
    }

    const [accepted] = await tx
      .update(careTeamInvitationsTable)
      .set({
        status: "accepted",
        acceptedAt,
        acceptedByUserId: userId,
      })
      .where(eq(careTeamInvitationsTable.id, invite.id))
      .returning();
    return accepted
      ? {
          invitation: accepted,
          userId,
          membershipRole: role.membershipRole,
          onboardingRequired,
        }
      : null;
  });
};
