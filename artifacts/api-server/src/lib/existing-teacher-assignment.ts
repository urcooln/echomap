import { clerkClient } from "@clerk/express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  betaControlsTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  teamConversationParticipantsTable,
  teamConversationsTable,
  teamMessageReadsTable,
  teamMessagesTable,
  usersTable,
} from "@workspace/db";
import { runtimeConfig } from "./runtime-config";

export type CareTeamInviteRole = "Parent" | "Teacher";

export type ExistingCareTeamAccountResolution =
  | { kind: "new" }
  | {
      kind: "existing";
      status: "available" | "already_assigned";
      userId: string;
      member: { name: string; role: CareTeamInviteRole };
    }
  | { kind: "review_required"; reason: string };

export type ExistingTeacherLookupStatus =
  "available" | "already_assigned" | "not_found" | "different_role";

export class ExistingTeacherAssignmentError extends Error {
  constructor(
    public readonly code:
      | "teacher_not_found"
      | "child_not_found"
      | "already_assigned"
      | "different_role"
      | "membership_limit",
  ) {
    super(code);
    this.name = "ExistingTeacherAssignmentError";
  }
}

export const normalizeTeacherEmail = (email: string) =>
  email.trim().toLowerCase();

export const isValidTeacherEmail = (email: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeTeacherEmail(email));

const membershipRole = (role: CareTeamInviteRole) => role.toLowerCase();

const participantKey = (userIds: string[]) =>
  [...new Set(userIds)].sort().join(":");

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

/**
 * Exact-email account resolution is server-owned. In deployed environments a
 * ChildLed record must also match the Clerk identity for that email.
 */
export const resolveExistingCareTeamAccount = async ({
  childId,
  email,
  role,
}: {
  childId: number;
  email: string;
  role: CareTeamInviteRole;
}): Promise<ExistingCareTeamAccountResolution> => {
  const normalizedEmail = normalizeTeacherEmail(email);
  const [rows, clerkUserIds] = await Promise.all([
    db
      .select({
        userId: usersTable.id,
        name: usersTable.displayName,
        identityProvider: usersTable.identityProvider,
        providerSubject: usersTable.providerSubject,
        disabledAt: usersTable.disabledAt,
        membershipId: organizationMembershipsTable.id,
        membershipRole: organizationMembershipsTable.role,
        membershipActive: organizationMembershipsTable.active,
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
          sql`lower(${usersTable.email}) = ${normalizedEmail}`,
          isNull(usersTable.archivedAt),
        ),
      )
      .orderBy(desc(organizationMembershipsTable.updatedAt)),
    exactClerkUserIds(normalizedEmail),
  ]);

  const childLedUserIds = new Set(rows.map((row) => row.userId));
  if (childLedUserIds.size > 1 || clerkUserIds.size > 1) {
    return {
      kind: "review_required",
      reason:
        "This email matches multiple account records. No role or student access was changed.",
    };
  }
  if (!rows.length) {
    return clerkUserIds.size
      ? {
          kind: "review_required",
          reason:
            "This email already has a Clerk account without an eligible ChildLed role. Review the account before inviting it.",
        }
      : { kind: "new" };
  }

  const user = rows[0]!;
  if (user.disabledAt) {
    return {
      kind: "review_required",
      reason:
        "This ChildLed account is disabled. No student access was changed.",
    };
  }
  if (
    runtimeConfig.isProduction &&
    (user.identityProvider !== "clerk" ||
      !clerkUserIds.has(user.providerSubject))
  ) {
    return {
      kind: "review_required",
      reason:
        "The ChildLed and Clerk identity records for this email do not match. No student access was changed.",
    };
  }

  const expectedRole = membershipRole(role);
  const memberships = rows.filter((row) => row.membershipId);
  if (!memberships.length) {
    return {
      kind: "review_required",
      reason:
        "This email already has a ChildLed account without an assigned role. Review the account before continuing.",
    };
  }
  if (
    memberships.some(
      (membership) =>
        membership.membershipRole?.trim().toLowerCase() !== expectedRole,
    )
  ) {
    return {
      kind: "review_required",
      reason: `This email is already associated with a different ChildLed account type and cannot be changed to ${role}.`,
    };
  }
  const eligible = memberships.find(
    (membership) =>
      !membership.organizationArchivedAt &&
      !membership.organizationDisabledAt &&
      membership.membershipActive,
  );
  if (!eligible) {
    return {
      kind: "review_required",
      reason:
        "This account does not have active ChildLed access. Review the account before continuing.",
    };
  }

  const [assignment] = await db
    .select({ id: childCareTeamMembershipsTable.id })
    .from(childCareTeamMembershipsTable)
    .where(
      and(
        eq(childCareTeamMembershipsTable.childId, childId),
        eq(childCareTeamMembershipsTable.userId, user.userId),
        eq(childCareTeamMembershipsTable.active, true),
      ),
    )
    .limit(1);
  return {
    kind: "existing",
    status: assignment ? "already_assigned" : "available",
    userId: user.userId,
    member: { name: user.name, role },
  };
};

export const assignExistingCareTeamAccount = async ({
  organizationId,
  childId,
  email,
  role,
  userId,
  assignedByUserId,
}: {
  organizationId: number;
  childId: number;
  email: string;
  role: CareTeamInviteRole;
  userId: string;
  assignedByUserId: string;
}) => {
  const normalizedEmail = normalizeTeacherEmail(email);
  const expectedRole = membershipRole(role);
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
    );
    const [child] = await transaction
      .select({
        id: childProfilesTable.id,
        name: childProfilesTable.displayName,
      })
      .from(childProfilesTable)
      .where(
        and(
          eq(childProfilesTable.id, childId),
          eq(childProfilesTable.organizationId, organizationId),
          isNull(childProfilesTable.archivedAt),
        ),
      )
      .limit(1);
    const [user] = await transaction
      .select({ id: usersTable.id, name: usersTable.displayName })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, userId),
          sql`lower(${usersTable.email}) = ${normalizedEmail}`,
          isNull(usersTable.archivedAt),
          isNull(usersTable.disabledAt),
        ),
      )
      .limit(1);
    const memberships = await transaction
      .select()
      .from(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.userId, userId));
    const [organization] = await transaction
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId))
      .limit(1);
    const [controls] = await transaction
      .select()
      .from(betaControlsTable)
      .where(eq(betaControlsTable.id, 1))
      .limit(1);
    if (!child) throw new ExistingTeacherAssignmentError("child_not_found");
    if (!user) throw new ExistingTeacherAssignmentError("teacher_not_found");
    if (
      !memberships.length ||
      memberships.some(
        (membership) => membership.role.trim().toLowerCase() !== expectedRole,
      )
    ) {
      throw new ExistingTeacherAssignmentError("different_role");
    }

    const targetMembership = memberships.find(
      (membership) => membership.organizationId === organizationId,
    );
    const sourceMembership =
      (targetMembership?.active ? targetMembership : undefined) ??
      memberships.find(
        (membership) =>
          membership.active && membership.accountStatus === "active",
      ) ??
      targetMembership ??
      memberships[0]!;
    if (!targetMembership?.active) {
      const [activeCount] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(organizationMembershipsTable)
        .where(
          and(
            eq(organizationMembershipsTable.organizationId, organizationId),
            eq(organizationMembershipsTable.active, true),
          ),
        );
      const membershipLimit =
        organization?.betaUserLimit ??
        controls?.defaultOrganizationUserLimit ??
        null;
      if (
        membershipLimit !== null &&
        (activeCount?.count ?? 0) >= membershipLimit
      ) {
        throw new ExistingTeacherAssignmentError("membership_limit");
      }
    }
    await transaction
      .insert(organizationMembershipsTable)
      .values({
        organizationId,
        userId,
        role: expectedRole,
        active: true,
        accountStatus: sourceMembership.accountStatus,
        onboardingCompletedAt: sourceMembership.onboardingCompletedAt,
      })
      .onConflictDoUpdate({
        target: [
          organizationMembershipsTable.organizationId,
          organizationMembershipsTable.userId,
        ],
        set: {
          active: true,
          accountStatus: sourceMembership.accountStatus,
          onboardingCompletedAt: sourceMembership.onboardingCompletedAt,
          updatedAt: new Date(),
        },
      });

    const [reactivated] = await transaction
      .update(childCareTeamMembershipsTable)
      .set({ active: true, role: expectedRole, updatedAt: new Date() })
      .where(
        and(
          eq(childCareTeamMembershipsTable.childId, child.id),
          eq(childCareTeamMembershipsTable.userId, user.id),
          eq(childCareTeamMembershipsTable.active, false),
        ),
      )
      .returning({ id: childCareTeamMembershipsTable.id });
    const [inserted] = reactivated
      ? [undefined]
      : await transaction
          .insert(childCareTeamMembershipsTable)
          .values({
            childId: child.id,
            userId: user.id,
            role: expectedRole,
            active: true,
          })
          .onConflictDoNothing()
          .returning({ id: childCareTeamMembershipsTable.id });
    const membership = reactivated ?? inserted;
    if (!membership)
      throw new ExistingTeacherAssignmentError("already_assigned");

    const key = participantKey([assignedByUserId, user.id]);
    const [conversation] = await transaction
      .insert(teamConversationsTable)
      .values({
        organizationId,
        childId: child.id,
        participantKey: key,
        createdByUserId: assignedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          teamConversationsTable.organizationId,
          teamConversationsTable.childId,
          teamConversationsTable.participantKey,
        ],
        set: { updatedAt: new Date() },
      })
      .returning({ id: teamConversationsTable.id });
    if (!conversation)
      throw new Error("Care-team conversation was not created.");
    await transaction
      .insert(teamConversationParticipantsTable)
      .values([
        {
          conversationId: conversation.id,
          userId: assignedByUserId,
          role: "clinician",
          lastReadAt: new Date(),
        },
        {
          conversationId: conversation.id,
          userId: user.id,
          role: expectedRole,
        },
      ])
      .onConflictDoNothing();
    const [message] = await transaction
      .insert(teamMessagesTable)
      .values({
        organizationId,
        childId: child.id,
        conversationId: conversation.id,
        senderUserId: assignedByUserId,
        senderRole: "clinician",
        messageType: "update",
        audience: "entire_team",
        body: `New student added\n\nYou now have access to ${child.name} in ChildLed.`,
      })
      .returning({
        id: teamMessagesTable.id,
        createdAt: teamMessagesTable.createdAt,
      });
    if (!message) throw new Error("Care-team notification was not created.");
    await transaction.insert(teamMessageReadsTable).values({
      messageId: message.id,
      userId: assignedByUserId,
    });
    await transaction
      .update(teamConversationsTable)
      .set({ updatedAt: message.createdAt })
      .where(eq(teamConversationsTable.id, conversation.id));

    return {
      childId: child.id,
      membershipId: membership.id,
      notificationId: message.id,
      member: { name: user.name, role },
    };
  });
};

// Compatibility wrappers for the existing Teacher-specific API endpoints.
export const lookupExistingTeacherAccount = async ({
  organizationId: _organizationId,
  childId,
  email,
}: {
  organizationId: number;
  childId: number;
  email: string;
}) => {
  const resolution = await resolveExistingCareTeamAccount({
    childId,
    email,
    role: "Teacher",
  });
  if (resolution.kind === "new") return { status: "not_found" as const };
  if (resolution.kind === "review_required") {
    return { status: "different_role" as const };
  }
  return {
    status: resolution.status,
    teacher: resolution.member,
  };
};

export const assignExistingTeacherAccount = async ({
  organizationId,
  childId,
  email,
  assignedByUserId,
}: {
  organizationId: number;
  childId: number;
  email: string;
  assignedByUserId: string;
}) => {
  const resolution = await resolveExistingCareTeamAccount({
    childId,
    email,
    role: "Teacher",
  });
  if (resolution.kind !== "existing") {
    throw new ExistingTeacherAssignmentError(
      resolution.kind === "review_required"
        ? "different_role"
        : "teacher_not_found",
    );
  }
  const result = await assignExistingCareTeamAccount({
    organizationId,
    childId,
    email,
    role: "Teacher",
    userId: resolution.userId,
    assignedByUserId,
  });
  return { ...result, teacher: result.member };
};
