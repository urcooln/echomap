import { and, eq, isNull, sql } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  db,
  organizationMembershipsTable,
  teamConversationParticipantsTable,
  teamConversationsTable,
  teamMessageReadsTable,
  teamMessagesTable,
  usersTable,
} from "@workspace/db";

export type ExistingTeacherLookupStatus =
  "available" | "already_assigned" | "not_found" | "different_role";

export class ExistingTeacherAssignmentError extends Error {
  constructor(
    public readonly code:
      "teacher_not_found" | "child_not_found" | "already_assigned",
  ) {
    super(code);
    this.name = "ExistingTeacherAssignmentError";
  }
}

export const normalizeTeacherEmail = (email: string) =>
  email.trim().toLowerCase();

export const isValidTeacherEmail = (email: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeTeacherEmail(email));

const participantKey = (userIds: string[]) =>
  [...new Set(userIds)].sort().join(":");

export const lookupExistingTeacherAccount = async ({
  organizationId,
  childId,
  email,
}: {
  organizationId: number;
  childId: number;
  email: string;
}) => {
  const normalizedEmail = normalizeTeacherEmail(email);
  const matches = await db
    .select({
      userId: usersTable.id,
      name: usersTable.displayName,
      disabledAt: usersTable.disabledAt,
      membershipRole: organizationMembershipsTable.role,
      membershipActive: organizationMembershipsTable.active,
    })
    .from(usersTable)
    .leftJoin(
      organizationMembershipsTable,
      and(
        eq(organizationMembershipsTable.userId, usersTable.id),
        eq(organizationMembershipsTable.organizationId, organizationId),
      ),
    )
    .where(
      and(
        sql`lower(${usersTable.email}) = ${normalizedEmail}`,
        isNull(usersTable.archivedAt),
      ),
    )
    .limit(3);

  if (!matches.length) {
    return { status: "not_found" as const };
  }
  const teacher = matches.find(
    (match) =>
      match.membershipActive === true &&
      match.membershipRole?.toLowerCase() === "teacher" &&
      !match.disabledAt,
  );
  if (!teacher) {
    return { status: "different_role" as const };
  }
  const [assignment] = await db
    .select({ id: childCareTeamMembershipsTable.id })
    .from(childCareTeamMembershipsTable)
    .where(
      and(
        eq(childCareTeamMembershipsTable.childId, childId),
        eq(childCareTeamMembershipsTable.userId, teacher.userId),
        eq(childCareTeamMembershipsTable.active, true),
      ),
    )
    .limit(1);
  return {
    status: assignment ? ("already_assigned" as const) : ("available" as const),
    teacher: { name: teacher.name, role: "Teacher" as const },
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
  const normalizedEmail = normalizeTeacherEmail(email);
  return db.transaction(async (transaction) => {
    const [[child], [teacher]] = await Promise.all([
      transaction
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
        .limit(1),
      transaction
        .select({ userId: usersTable.id, name: usersTable.displayName })
        .from(usersTable)
        .innerJoin(
          organizationMembershipsTable,
          and(
            eq(organizationMembershipsTable.userId, usersTable.id),
            eq(organizationMembershipsTable.organizationId, organizationId),
            eq(organizationMembershipsTable.active, true),
            eq(
              sql<string>`lower(${organizationMembershipsTable.role})`,
              "teacher",
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
        .limit(1),
    ]);
    if (!child) throw new ExistingTeacherAssignmentError("child_not_found");
    if (!teacher) throw new ExistingTeacherAssignmentError("teacher_not_found");

    const [reactivated] = await transaction
      .update(childCareTeamMembershipsTable)
      .set({ active: true, role: "teacher", updatedAt: new Date() })
      .where(
        and(
          eq(childCareTeamMembershipsTable.childId, child.id),
          eq(childCareTeamMembershipsTable.userId, teacher.userId),
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
            userId: teacher.userId,
            role: "teacher",
            active: true,
          })
          .onConflictDoNothing()
          .returning({ id: childCareTeamMembershipsTable.id });
    const membership = reactivated ?? inserted;
    if (!membership)
      throw new ExistingTeacherAssignmentError("already_assigned");

    const key = participantKey([assignedByUserId, teacher.userId]);
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
    if (!conversation) throw new Error("Teacher conversation was not created.");
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
          userId: teacher.userId,
          role: "teacher",
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
    if (!message) throw new Error("Teacher notification was not created.");
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
      teacher: { name: teacher.name, role: "Teacher" as const },
    };
  });
};
