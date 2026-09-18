import { and, eq } from "drizzle-orm";
import {
  db,
  organizationMembershipsTable,
  schoolDistrictsTable,
  slpProfilesTable,
  userAgreementAcceptancesTable,
  usersTable,
} from "@workspace/db";
import { SLP_AGREEMENTS } from "./slp-onboarding";
import { completePendingStudentTransfersForSlp } from "./student-transfer";

export type SlpOnboardingProfileValues = {
  firstName: string;
  lastName: string;
  professionalTitle: string;
  school: string;
  districtId: number;
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

export class SlpOnboardingDistrictError extends Error {
  constructor() {
    super("Select an active ChildLed school district.");
    this.name = "SlpOnboardingDistrictError";
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
    if (!Number.isSafeInteger(profile.districtId) || profile.districtId < 1) {
      throw new SlpOnboardingDistrictError();
    }
    const [district] = await tx
      .select({ id: schoolDistrictsTable.id, name: schoolDistrictsTable.name })
      .from(schoolDistrictsTable)
      .where(
        and(
          eq(schoolDistrictsTable.id, profile.districtId),
          eq(schoolDistrictsTable.active, true),
        ),
      )
      .limit(1);
    if (!district) throw new SlpOnboardingDistrictError();
    const { districtId: _districtId, ...profileFields } = profile;
    await tx
      .insert(slpProfilesTable)
      .values({
        organizationId,
        userId,
        ...profileFields,
        districtId: district.id,
        schoolDistrict: district.name,
        licenseVerificationStatus: "unverified",
      })
      .onConflictDoUpdate({
        target: [slpProfilesTable.organizationId, slpProfilesTable.userId],
        set: {
          ...profileFields,
          districtId: district.id,
          schoolDistrict: district.name,
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
    const [user] = await tx
      .update(usersTable)
      .set({ displayName: `${profile.firstName} ${profile.lastName}`.trim() })
      .where(eq(usersTable.id, userId))
      .returning({ email: usersTable.email });
    const completedTransferIds = user?.email
      ? await completePendingStudentTransfersForSlp({
          transaction: tx,
          organizationId,
          destinationUserId: userId,
          destinationEmail: user.email,
          completedAt,
        })
      : [];
    return { ...membership, completedTransferIds };
  });
