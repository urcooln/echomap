import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  betaControlsTable,
  careTeamInvitationsTable,
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  slpProfilesTable,
  studentTransfersTable,
  teamConversationParticipantsTable,
  teamConversationsTable,
  teamMessageReadsTable,
  teamMessagesTable,
  usersTable,
} from "@workspace/db";

export type StudentTransferLookupStatus =
  | "available"
  | "current_slp"
  | "not_found"
  | "different_role"
  | "different_workspace"
  | "pending_transfer";

export class StudentTransferError extends Error {
  constructor(
    public readonly code:
      | "child_not_found"
      | "source_not_authorized"
      | "destination_not_found"
      | "destination_not_eligible"
      | "same_slp"
      | "pending_transfer"
      | "pending_invitation"
      | "invitation_limit"
      | "transfer_not_found"
      | "transfer_not_pending",
  ) {
    super(code);
    this.name = "StudentTransferError";
  }
}

export const normalizeSlpEmail = (email: string) => email.trim().toLowerCase();

export const isValidSlpEmail = (email: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeSlpEmail(email));

const participantKey = (userIds: string[]) =>
  [...new Set(userIds)].sort().join(":");

type TransferTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Every child-owned table with its own workspace boundary must move with the
// child. Tables that inherit the child through another foreign key do not need
// a direct update. student_transfers intentionally stays in the source
// workspace as an immutable record of where the transfer originated.
const CHILD_SCOPED_ORGANIZATION_TABLES = [
  "aac_profile_history",
  "aac_profiles",
  "aac_vocabulary_planning",
  "aac_vocabulary_planning_merge_history",
  "care_team_invitations",
  "child_phrase_inbox_items",
  "child_speaker_profiles",
  "child_speaker_role_learning_aggregates",
  "clinical_documentation",
  "clinical_gestalts",
  "clinical_knowledge_applied_facts",
  "clinical_knowledge_insight_runs",
  "clinical_knowledge_insights",
  "clinical_observations",
  "clinical_soap_notes",
  "communication_goal_history",
  "communication_goals",
  "communication_passports",
  "dictionary_duplicate_suggestions",
  "gestalt_collaboration_notes",
  "iep_service_requirements",
  "legacy_phrase_observation_recoveries",
  "observation_video_uploads",
  "parent_learning_progress",
  "parent_learning_reflections",
  "phrase_observations",
  "session_audio_objects",
  "session_recording_preparations",
  "shared_child_profile_entries",
  "shared_child_profile_history",
  "teacher_resource_progress",
  "team_conversations",
  "team_messages",
  "therapy_session_goal_progress",
  "therapy_sessions",
  "transcript_speaker_role_inferences",
] as const;

const retainCareTeamWorkspaceAccess = async ({
  transaction,
  childId,
  sourceOrganizationId,
  destinationOrganizationId,
  destinationUserId,
}: {
  transaction: TransferTransaction;
  childId: number;
  sourceOrganizationId: number;
  destinationOrganizationId: number;
  destinationUserId: string;
}) => {
  if (sourceOrganizationId === destinationOrganizationId) return;
  const retainedMembers = await transaction
    .select({
      userId: childCareTeamMembershipsTable.userId,
      childRole: childCareTeamMembershipsTable.role,
      organizationRole: organizationMembershipsTable.role,
      accountStatus: organizationMembershipsTable.accountStatus,
      onboardingCompletedAt: organizationMembershipsTable.onboardingCompletedAt,
    })
    .from(childCareTeamMembershipsTable)
    .innerJoin(
      organizationMembershipsTable,
      and(
        eq(
          organizationMembershipsTable.userId,
          childCareTeamMembershipsTable.userId,
        ),
        eq(
          organizationMembershipsTable.organizationId,
          sourceOrganizationId,
        ),
        eq(organizationMembershipsTable.active, true),
      ),
    )
    .where(
      and(
        eq(childCareTeamMembershipsTable.childId, childId),
        eq(childCareTeamMembershipsTable.active, true),
        ne(childCareTeamMembershipsTable.userId, destinationUserId),
        ne(
          sql<string>`lower(${childCareTeamMembershipsTable.role})`,
          "clinician",
        ),
      ),
    );

  for (const member of retainedMembers) {
    const role = member.organizationRole.toLowerCase();
    const portableRole =
      role === "teacher" || role === "parent"
        ? role
        : member.childRole.toLowerCase() === "teacher"
          ? "teacher"
          : "parent";
    await transaction
      .insert(organizationMembershipsTable)
      .values({
        organizationId: destinationOrganizationId,
        userId: member.userId,
        role: portableRole,
        active: true,
        accountStatus: member.accountStatus,
        onboardingCompletedAt: member.onboardingCompletedAt,
      })
      .onConflictDoUpdate({
        target: [
          organizationMembershipsTable.organizationId,
          organizationMembershipsTable.userId,
        ],
        set: { updatedAt: new Date() },
      });
  }
};

const moveChildToWorkspace = async ({
  transaction,
  childId,
  sourceOrganizationId,
  destinationOrganizationId,
}: {
  transaction: TransferTransaction;
  childId: number;
  sourceOrganizationId: number;
  destinationOrganizationId: number;
}) => {
  if (sourceOrganizationId === destinationOrganizationId) return;
  for (const tableName of CHILD_SCOPED_ORGANIZATION_TABLES) {
    await transaction.execute(
      sql`update ${sql.identifier(tableName)}
          set organization_id = ${destinationOrganizationId}
          where child_id = ${childId}
            and organization_id = ${sourceOrganizationId}`,
    );
  }
  const [movedChild] = await transaction
    .update(childProfilesTable)
    .set({ organizationId: destinationOrganizationId, updatedAt: new Date() })
    .where(
      and(
        eq(childProfilesTable.id, childId),
        eq(childProfilesTable.organizationId, sourceOrganizationId),
      ),
    )
    .returning({ id: childProfilesTable.id });
  if (!movedChild) throw new StudentTransferError("child_not_found");
};

const activeSourceMembership = async (
  transaction: TransferTransaction,
  organizationId: number,
  childId: number,
  sourceUserId: string,
) => {
  const [child] = await transaction
    .select({
      id: childProfilesTable.id,
      name: childProfilesTable.displayName,
      childLedId: childProfilesTable.childLedId,
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
  const [membership] = await transaction
    .select({ id: childCareTeamMembershipsTable.id })
    .from(childCareTeamMembershipsTable)
    .where(
      and(
        eq(childCareTeamMembershipsTable.childId, childId),
        eq(childCareTeamMembershipsTable.userId, sourceUserId),
        eq(childCareTeamMembershipsTable.active, true),
        eq(
          sql<string>`lower(${childCareTeamMembershipsTable.role})`,
          "clinician",
        ),
      ),
    )
    .limit(1);
  if (!child) throw new StudentTransferError("child_not_found");
  if (!membership) throw new StudentTransferError("source_not_authorized");
  return child;
};

const eligibleDestinationSlp = async (
  transaction: TransferTransaction,
  sourceOrganizationId: number,
  normalizedEmail: string,
) => {
  const [destination] = await transaction
    .select({
      userId: usersTable.id,
      name: usersTable.displayName,
      organizationId: organizationMembershipsTable.organizationId,
      professionalTitle: slpProfilesTable.professionalTitle,
    })
    .from(usersTable)
    .innerJoin(
      organizationMembershipsTable,
      and(
        eq(organizationMembershipsTable.userId, usersTable.id),
        eq(organizationMembershipsTable.active, true),
        eq(organizationMembershipsTable.accountStatus, "active"),
        eq(
          sql<string>`lower(${organizationMembershipsTable.role})`,
          "clinician",
        ),
      ),
    )
    .innerJoin(
      organizationsTable,
      and(
        eq(organizationsTable.id, organizationMembershipsTable.organizationId),
        isNull(organizationsTable.archivedAt),
        isNull(organizationsTable.disabledAt),
      ),
    )
    .leftJoin(
      slpProfilesTable,
      and(
        eq(slpProfilesTable.userId, usersTable.id),
        eq(
          slpProfilesTable.organizationId,
          organizationMembershipsTable.organizationId,
        ),
      ),
    )
    .where(
      and(
        sql`lower(${usersTable.email}) = ${normalizedEmail}`,
        isNull(usersTable.archivedAt),
        isNull(usersTable.disabledAt),
      ),
    )
    .orderBy(
      sql`case when ${organizationMembershipsTable.organizationId} = ${sourceOrganizationId} then 0 else 1 end`,
      desc(organizationMembershipsTable.updatedAt),
    )
    .limit(1);
  return destination;
};

const completeTransferInTransaction = async ({
  transaction,
  transferId,
  organizationId,
  destinationOrganizationId = organizationId,
  destinationUserId,
  completedAt,
}: {
  transaction: TransferTransaction;
  transferId: number;
  organizationId: number;
  destinationOrganizationId?: number;
  destinationUserId: string;
  completedAt: Date;
}) => {
  const [transfer] = await transaction
    .select()
    .from(studentTransfersTable)
    .where(
      and(
        eq(studentTransfersTable.id, transferId),
        eq(studentTransfersTable.organizationId, organizationId),
        eq(studentTransfersTable.status, "pending"),
      ),
    )
    .limit(1)
    .for("update");
  if (!transfer) throw new StudentTransferError("transfer_not_pending");
  await transaction.execute(
    sql`select id from child_profiles where id = ${transfer.childId} and organization_id = ${organizationId} for update`,
  );
  if (transfer.fromSlpUserId === destinationUserId) {
    throw new StudentTransferError("same_slp");
  }
  const [destinationMembership] = await transaction
    .select({ id: organizationMembershipsTable.id })
    .from(organizationMembershipsTable)
    .where(
      and(
        eq(
          organizationMembershipsTable.organizationId,
          destinationOrganizationId,
        ),
        eq(organizationMembershipsTable.userId, destinationUserId),
        eq(organizationMembershipsTable.active, true),
        eq(organizationMembershipsTable.accountStatus, "active"),
        eq(
          sql<string>`lower(${organizationMembershipsTable.role})`,
          "clinician",
        ),
      ),
    )
    .limit(1)
    .for("update");
  if (!destinationMembership) {
    throw new StudentTransferError("destination_not_eligible");
  }
  const child = await activeSourceMembership(
    transaction,
    organizationId,
    transfer.childId,
    transfer.fromSlpUserId,
  );
  const [destinationChildMembership] = await transaction
    .insert(childCareTeamMembershipsTable)
    .values({
      childId: transfer.childId,
      userId: destinationUserId,
      role: "clinician",
      active: true,
    })
    .onConflictDoUpdate({
      target: [
        childCareTeamMembershipsTable.childId,
        childCareTeamMembershipsTable.userId,
      ],
      set: { role: "clinician", active: true, updatedAt: completedAt },
    })
    .returning({ id: childCareTeamMembershipsTable.id });
  if (!destinationChildMembership) {
    throw new Error("Destination SLP membership was not created.");
  }
  await retainCareTeamWorkspaceAccess({
    transaction,
    childId: transfer.childId,
    sourceOrganizationId: organizationId,
    destinationOrganizationId,
    destinationUserId,
  });
  await transaction
    .update(childCareTeamMembershipsTable)
    .set({ active: false, updatedAt: completedAt })
    .where(
      and(
        eq(childCareTeamMembershipsTable.childId, transfer.childId),
        eq(childCareTeamMembershipsTable.active, true),
        eq(
          sql<string>`lower(${childCareTeamMembershipsTable.role})`,
          "clinician",
        ),
        ne(childCareTeamMembershipsTable.userId, destinationUserId),
      ),
    );
  await moveChildToWorkspace({
    transaction,
    childId: transfer.childId,
    sourceOrganizationId: organizationId,
    destinationOrganizationId,
  });
  const [completed] = await transaction
    .update(studentTransfersTable)
    .set({
      toSlpUserId: destinationUserId,
      status: "completed",
      completedAt,
      updatedAt: completedAt,
    })
    .where(
      and(
        eq(studentTransfersTable.id, transfer.id),
        eq(studentTransfersTable.status, "pending"),
      ),
    )
    .returning();
  if (!completed) throw new StudentTransferError("transfer_not_pending");

  const key = participantKey([transfer.fromSlpUserId, destinationUserId]);
  const [conversation] = await transaction
    .insert(teamConversationsTable)
    .values({
      organizationId: destinationOrganizationId,
      childId: transfer.childId,
      participantKey: key,
      createdByUserId: transfer.initiatedByUserId,
    })
    .onConflictDoUpdate({
      target: [
        teamConversationsTable.organizationId,
        teamConversationsTable.childId,
        teamConversationsTable.participantKey,
      ],
      set: { updatedAt: completedAt },
    })
    .returning({ id: teamConversationsTable.id });
  if (!conversation) throw new Error("Transfer conversation was not created.");
  await transaction
    .insert(teamConversationParticipantsTable)
    .values([
      {
        conversationId: conversation.id,
        userId: transfer.fromSlpUserId,
        role: "clinician",
        lastReadAt: completedAt,
      },
      {
        conversationId: conversation.id,
        userId: destinationUserId,
        role: "clinician",
      },
    ])
    .onConflictDoNothing();
  const [message] = await transaction
    .insert(teamMessagesTable)
    .values({
      organizationId: destinationOrganizationId,
      childId: transfer.childId,
      conversationId: conversation.id,
      senderUserId: transfer.initiatedByUserId,
      senderRole: "clinician",
      messageType: "update",
      audience: "entire_team",
      body: `Student transfer completed\n\nYou are now the primary SLP for ${child.name} in ChildLed.`,
    })
    .returning({
      id: teamMessagesTable.id,
      createdAt: teamMessagesTable.createdAt,
    });
  if (!message) throw new Error("Transfer notification was not created.");
  await transaction.insert(teamMessageReadsTable).values({
    messageId: message.id,
    userId: transfer.initiatedByUserId,
  });
  await transaction
    .update(teamConversationsTable)
    .set({ updatedAt: message.createdAt })
    .where(eq(teamConversationsTable.id, conversation.id));

  return { transfer: completed, child, notificationId: message.id };
};

export const lookupStudentTransferSlp = async ({
  organizationId,
  childId,
  currentSlpUserId,
  email,
}: {
  organizationId: number;
  childId: number;
  currentSlpUserId: string;
  email: string;
}) => {
  const normalizedEmail = normalizeSlpEmail(email);
  const [pending] = await db
    .select({ id: studentTransfersTable.id })
    .from(studentTransfersTable)
    .where(
      and(
        eq(studentTransfersTable.organizationId, organizationId),
        eq(studentTransfersTable.childId, childId),
        eq(studentTransfersTable.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) return { status: "pending_transfer" as const };

  const matches = await db
    .select({
      userId: usersTable.id,
      name: usersTable.displayName,
      disabledAt: usersTable.disabledAt,
      organizationId: organizationMembershipsTable.organizationId,
      role: organizationMembershipsTable.role,
      membershipActive: organizationMembershipsTable.active,
      accountStatus: organizationMembershipsTable.accountStatus,
      onboardingCompletedAt: organizationMembershipsTable.onboardingCompletedAt,
      professionalTitle: slpProfilesTable.professionalTitle,
      organizationArchivedAt: organizationsTable.archivedAt,
      organizationDisabledAt: organizationsTable.disabledAt,
      organizationBetaApprovedAt: organizationsTable.betaApprovedAt,
    })
    .from(usersTable)
    .leftJoin(
      organizationMembershipsTable,
      eq(organizationMembershipsTable.userId, usersTable.id),
    )
    .leftJoin(
      slpProfilesTable,
      and(
        eq(slpProfilesTable.userId, usersTable.id),
        eq(
          slpProfilesTable.organizationId,
          organizationMembershipsTable.organizationId,
        ),
      ),
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
    .limit(10);
  if (!matches.length) return { status: "not_found" as const };
  if (matches.some((match) => match.userId === currentSlpUserId)) {
    return { status: "current_slp" as const };
  }
  const eligible = [...matches]
    .sort((left, right) =>
      left.organizationId === organizationId
        ? -1
        : right.organizationId === organizationId
          ? 1
          : 0,
    )
    .find(
      (match) =>
        match.membershipActive === true &&
        match.role?.toLowerCase() === "clinician" &&
        match.accountStatus === "active" &&
        Boolean(match.onboardingCompletedAt) &&
        !match.disabledAt &&
        !match.organizationArchivedAt &&
        !match.organizationDisabledAt &&
        Boolean(match.organizationBetaApprovedAt),
    );
  if (eligible) {
    return {
      status: "available" as const,
      slp: {
        name: eligible.name,
        role: "SLP" as const,
        professionalTitle:
          eligible.professionalTitle || "Speech-Language Pathologist",
      },
    };
  }
  return { status: "different_role" as const };
};

export const completeExistingStudentTransfer = async ({
  organizationId,
  childId,
  currentSlpUserId,
  email,
  requestedAt = new Date(),
}: {
  organizationId: number;
  childId: number;
  currentSlpUserId: string;
  email: string;
  requestedAt?: Date;
}) => {
  const normalizedEmail = normalizeSlpEmail(email);
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select id from child_profiles where id = ${childId} and organization_id = ${organizationId} for update`,
    );
    await activeSourceMembership(
      transaction,
      organizationId,
      childId,
      currentSlpUserId,
    );
    const destination = await eligibleDestinationSlp(
      transaction,
      organizationId,
      normalizedEmail,
    );
    if (!destination) {
      throw new StudentTransferError("destination_not_eligible");
    }
    if (destination.userId === currentSlpUserId) {
      throw new StudentTransferError("same_slp");
    }
    const [pending] = await transaction
      .select({ id: studentTransfersTable.id })
      .from(studentTransfersTable)
      .where(
        and(
          eq(studentTransfersTable.childId, childId),
          eq(studentTransfersTable.status, "pending"),
        ),
      )
      .limit(1);
    if (pending) throw new StudentTransferError("pending_transfer");
    const [created] = await transaction
      .insert(studentTransfersTable)
      .values({
        organizationId,
        childId,
        fromSlpUserId: currentSlpUserId,
        toSlpUserId: destination.userId,
        destinationEmail: normalizedEmail,
        transferMode: "existing_account",
        status: "pending",
        initiatedByUserId: currentSlpUserId,
        requestedAt,
      })
      .returning();
    if (!created) throw new Error("Student transfer was not created.");
    const completed = await completeTransferInTransaction({
      transaction,
      transferId: created.id,
      organizationId,
      destinationUserId: destination.userId,
      destinationOrganizationId: destination.organizationId,
      completedAt: requestedAt,
    });
    return {
      ...completed,
      destination: {
        userId: destination.userId,
        name: destination.name,
        professionalTitle:
          destination.professionalTitle || "Speech-Language Pathologist",
      },
    };
  });
};

export const createPendingStudentTransfer = async ({
  organizationId,
  childId,
  currentSlpUserId,
  email,
  tokenHash,
  expiresAt,
}: {
  organizationId: number;
  childId: number;
  currentSlpUserId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
}) => {
  const normalizedEmail = normalizeSlpEmail(email);
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select id from child_profiles where id = ${childId} and organization_id = ${organizationId} for update`,
    );
    const child = await activeSourceMembership(
      transaction,
      organizationId,
      childId,
      currentSlpUserId,
    );
    const existingUsers = await transaction
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          sql`lower(${usersTable.email}) = ${normalizedEmail}`,
          isNull(usersTable.archivedAt),
        ),
      )
      .limit(1);
    if (existingUsers.length) {
      throw new StudentTransferError("destination_not_eligible");
    }
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
    const [existingInvitation] = await transaction
      .select({ id: careTeamInvitationsTable.id })
      .from(careTeamInvitationsTable)
      .where(
        and(
          eq(careTeamInvitationsTable.organizationId, organizationId),
          sql`lower(${careTeamInvitationsTable.invitedEmail}) = ${normalizedEmail}`,
          eq(careTeamInvitationsTable.status, "pending"),
          isNull(careTeamInvitationsTable.revokedAt),
        ),
      )
      .limit(1);
    const [pending] = await transaction
      .select({ id: studentTransfersTable.id })
      .from(studentTransfersTable)
      .where(
        and(
          eq(studentTransfersTable.childId, childId),
          eq(studentTransfersTable.status, "pending"),
        ),
      )
      .limit(1);
    if (
      !organization ||
      organization.disabledAt ||
      organization.archivedAt ||
      !organization.betaApprovedAt ||
      !controls?.enabled
    ) {
      throw new StudentTransferError("source_not_authorized");
    }
    if (existingInvitation) {
      throw new StudentTransferError("pending_invitation");
    }
    if (pending) throw new StudentTransferError("pending_transfer");
    const dayAgo = new Date(Date.now() - 86_400_000);
    const [recent] = await transaction
      .select({ count: sql<number>`count(*)::int` })
      .from(careTeamInvitationsTable)
      .where(
        and(
          eq(careTeamInvitationsTable.organizationId, organizationId),
          sql`${careTeamInvitationsTable.createdAt} >= ${dayAgo}`,
        ),
      );
    if ((controls.invitationLimitPerDay ?? 25) <= (recent?.count ?? 0)) {
      throw new StudentTransferError("invitation_limit");
    }
    const [invitation] = await transaction
      .insert(careTeamInvitationsTable)
      .values({
        organizationId,
        childId,
        invitedEmail: normalizedEmail,
        invitedRole: "clinician",
        invitedByUserId: currentSlpUserId,
        tokenHash,
        expiresAt,
        accessScope: "organization",
        childScope: [],
      })
      .returning();
    if (!invitation) throw new Error("SLP invitation was not created.");
    const [transfer] = await transaction
      .insert(studentTransfersTable)
      .values({
        organizationId,
        childId,
        fromSlpUserId: currentSlpUserId,
        destinationEmail: normalizedEmail,
        transferMode: "invitation",
        status: "pending",
        invitationId: invitation.id,
        initiatedByUserId: currentSlpUserId,
      })
      .returning();
    if (!transfer) throw new Error("Pending student transfer was not created.");
    return { transfer, invitation, child };
  });
};

export const attachClerkInvitationToTransfer = async ({
  transferId,
  invitationId,
  clerkInvitationId,
}: {
  transferId: number;
  invitationId: number;
  clerkInvitationId: string;
}) => {
  await db.transaction(async (transaction) => {
    await transaction
      .update(careTeamInvitationsTable)
      .set({ clerkInvitationId })
      .where(eq(careTeamInvitationsTable.id, invitationId));
    await transaction
      .update(studentTransfersTable)
      .set({ updatedAt: new Date() })
      .where(eq(studentTransfersTable.id, transferId));
  });
};

export const failPendingStudentTransferInvitation = async ({
  transferId,
  invitationId,
  cancelledByUserId,
}: {
  transferId: number;
  invitationId: number;
  cancelledByUserId: string;
}) => {
  const cancelledAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(careTeamInvitationsTable)
      .set({
        status: "revoked",
        revokedAt: cancelledAt,
        revokedByUserId: cancelledByUserId,
      })
      .where(eq(careTeamInvitationsTable.id, invitationId));
    await transaction
      .update(studentTransfersTable)
      .set({
        status: "cancelled",
        cancelledAt,
        cancelledByUserId,
        updatedAt: cancelledAt,
      })
      .where(
        and(
          eq(studentTransfersTable.id, transferId),
          eq(studentTransfersTable.status, "pending"),
        ),
      );
  });
};

export const pendingStudentTransferForCancellation = async ({
  organizationId,
  transferId,
  currentSlpUserId,
}: {
  organizationId: number;
  transferId: number;
  currentSlpUserId: string;
}) => {
  const [transfer] = await db
    .select({
      id: studentTransfersTable.id,
      childId: studentTransfersTable.childId,
      invitationId: studentTransfersTable.invitationId,
      clerkInvitationId: careTeamInvitationsTable.clerkInvitationId,
      invitationStatus: careTeamInvitationsTable.status,
      acceptedByUserId: careTeamInvitationsTable.acceptedByUserId,
    })
    .from(studentTransfersTable)
    .leftJoin(
      careTeamInvitationsTable,
      eq(careTeamInvitationsTable.id, studentTransfersTable.invitationId),
    )
    .where(
      and(
        eq(studentTransfersTable.id, transferId),
        eq(studentTransfersTable.organizationId, organizationId),
        eq(studentTransfersTable.fromSlpUserId, currentSlpUserId),
        eq(studentTransfersTable.status, "pending"),
      ),
    )
    .limit(1);
  return transfer;
};

export const cancelPendingStudentTransfer = async ({
  organizationId,
  transferId,
  currentSlpUserId,
}: {
  organizationId: number;
  transferId: number;
  currentSlpUserId: string;
}) => {
  const cancelledAt = new Date();
  return db.transaction(async (transaction) => {
    const [transfer] = await transaction
      .update(studentTransfersTable)
      .set({
        status: "cancelled",
        cancelledAt,
        cancelledByUserId: currentSlpUserId,
        updatedAt: cancelledAt,
      })
      .where(
        and(
          eq(studentTransfersTable.id, transferId),
          eq(studentTransfersTable.organizationId, organizationId),
          eq(studentTransfersTable.fromSlpUserId, currentSlpUserId),
          eq(studentTransfersTable.status, "pending"),
        ),
      )
      .returning();
    if (!transfer) throw new StudentTransferError("transfer_not_found");
    if (transfer.invitationId) {
      await transaction
        .update(careTeamInvitationsTable)
        .set({
          status: "revoked",
          revokedAt: cancelledAt,
          revokedByUserId: currentSlpUserId,
        })
        .where(
          and(
            eq(careTeamInvitationsTable.id, transfer.invitationId),
            eq(careTeamInvitationsTable.status, "pending"),
          ),
        );
    }
    return transfer;
  });
};

export const completePendingStudentTransfersForSlp = async ({
  transaction,
  organizationId,
  destinationUserId,
  destinationEmail,
  completedAt,
}: {
  transaction: TransferTransaction;
  organizationId: number;
  destinationUserId: string;
  destinationEmail: string;
  completedAt: Date;
}) => {
  const pending = await transaction
    .select({ id: studentTransfersTable.id })
    .from(studentTransfersTable)
    .innerJoin(
      careTeamInvitationsTable,
      and(
        eq(careTeamInvitationsTable.id, studentTransfersTable.invitationId),
        eq(careTeamInvitationsTable.status, "accepted"),
        eq(careTeamInvitationsTable.acceptedByUserId, destinationUserId),
      ),
    )
    .where(
      and(
        eq(studentTransfersTable.organizationId, organizationId),
        eq(studentTransfersTable.status, "pending"),
        sql`lower(${studentTransfersTable.destinationEmail}) = ${normalizeSlpEmail(destinationEmail)}`,
      ),
    );
  const completedTransferIds: number[] = [];
  for (const transfer of pending) {
    await completeTransferInTransaction({
      transaction,
      transferId: transfer.id,
      organizationId,
      destinationUserId,
      completedAt,
    });
    completedTransferIds.push(transfer.id);
  }
  return completedTransferIds;
};

export const studentTransferHistory = async ({
  organizationId,
  childId,
}: {
  organizationId: number;
  childId: number;
}) => {
  const transfers = await db
    .select()
    .from(studentTransfersTable)
    .where(
      and(
        eq(studentTransfersTable.childId, childId),
      ),
    )
    .orderBy(desc(studentTransfersTable.requestedAt));
  const [child] = await db
    .select({
      name: childProfilesTable.displayName,
      childLedId: childProfilesTable.childLedId,
    })
    .from(childProfilesTable)
    .where(
      eq(childProfilesTable.id, childId),
    )
    .limit(1);
  const userIds = [
    ...new Set(
      transfers.flatMap((transfer) =>
        [transfer.fromSlpUserId, transfer.toSlpUserId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  ];
  const users = userIds.length
    ? await db
        .select({ id: usersTable.id, name: usersTable.displayName })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds))
    : [];
  const names = new Map(users.map((user) => [user.id, user.name]));
  return transfers.map((transfer) => ({
    transfer,
    child,
    fromSlpName: names.get(transfer.fromSlpUserId) ?? "Previous SLP",
    destinationSlpName: transfer.toSlpUserId
      ? names.get(transfer.toSlpUserId)
      : undefined,
  }));
};
