import { and, eq } from "drizzle-orm";
import { db, organizationMembershipsTable, usersTable } from "@workspace/db";

export type CareTeamOnboardingRole = "parent" | "teacher";

export class CareTeamOnboardingMembershipError extends Error {
  constructor() {
    super("Parent or Teacher membership is not active.");
    this.name = "CareTeamOnboardingMembershipError";
  }
}

export const completeCareTeamOnboardingAccount = async ({
  organizationId,
  userId,
  role,
  firstName,
  lastName,
  completedAt = new Date(),
}: {
  organizationId: number;
  userId: string;
  role: CareTeamOnboardingRole;
  firstName: string;
  lastName: string;
  completedAt?: Date;
}) =>
  db.transaction(async (tx) => {
    const [membership] = await tx
      .update(organizationMembershipsTable)
      .set({
        accountStatus: "active",
        onboardingCompletedAt: completedAt,
      })
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, organizationId),
          eq(organizationMembershipsTable.userId, userId),
          eq(organizationMembershipsTable.role, role),
          eq(organizationMembershipsTable.active, true),
        ),
      )
      .returning({ id: organizationMembershipsTable.id });
    if (!membership) throw new CareTeamOnboardingMembershipError();

    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const [user] = await tx
      .update(usersTable)
      .set({ displayName })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, displayName: usersTable.displayName });
    if (!user) throw new CareTeamOnboardingMembershipError();

    return { membership, user, completedAt };
  });
