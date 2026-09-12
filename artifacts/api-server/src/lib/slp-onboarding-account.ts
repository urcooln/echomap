import { and, eq } from "drizzle-orm";
import {
  db,
  organizationMembershipsTable,
  slpProfilesTable,
  userAgreementAcceptancesTable,
  usersTable,
} from "@workspace/db";
import { SLP_AGREEMENTS } from "./slp-onboarding";

export type SlpOnboardingProfileValues = {
  firstName: string;
  lastName: string;
  professionalTitle: string;
  school: string;
  schoolDistrict: string;
  licensureState: string;
  licenseNumber: string;
  licenseExpirationDate: string | null;
  ashaCccSlpNumber: string | null;
};

export class SlpOnboardingMembershipError extends Error {
  constructor() {
    super("SLP membership is not active.");
    this.name = "SlpOnboardingMembershipError";
  }
}

export const completeSlpOnboardingAccount = async ({
  organizationId,
  userId,
  clerkUserId,
  profile,
  completedAt = new Date(),
}: {
  organizationId: number;
  userId: string;
  clerkUserId: string;
  profile: SlpOnboardingProfileValues;
  completedAt?: Date;
}) =>
  db.transaction(async (tx) => {
    await tx
      .insert(slpProfilesTable)
      .values({
        organizationId,
        userId,
        ...profile,
        licenseVerificationStatus: "unverified",
      })
      .onConflictDoUpdate({
        target: [slpProfilesTable.organizationId, slpProfilesTable.userId],
        set: {
          ...profile,
          updatedAt: completedAt,
        },
      });
    await tx
      .insert(userAgreementAcceptancesTable)
      .values(
        SLP_AGREEMENTS.map((agreement) => ({
          organizationId,
          userId,
          clerkUserId,
          agreementType: agreement.type,
          documentVersion: agreement.version,
          acceptedAt: completedAt,
          school: profile.school,
        })),
      )
      .onConflictDoNothing();
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
          eq(organizationMembershipsTable.role, "clinician"),
          eq(organizationMembershipsTable.active, true),
        ),
      )
      .returning({ id: organizationMembershipsTable.id });
    if (!membership) throw new SlpOnboardingMembershipError();
    await tx
      .update(usersTable)
      .set({ displayName: `${profile.firstName} ${profile.lastName}`.trim() })
      .where(eq(usersTable.id, userId));
    return membership;
  });
