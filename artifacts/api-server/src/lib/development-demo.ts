import { createHash, randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  aacProfileHistoryTable,
  aacProfilesTable,
  childCareTeamMembershipsTable,
  childProfileConsentRecordsTable,
  childProfilesTable,
  childSpeakerProfilesTable,
  clinicalGestaltsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  sessionTranscriptsTable,
  therapySessionGestaltsTable,
  therapySessionsTable,
  transcriptSpeakerSegmentsTable,
  type AacProfileHistoryValue,
  usersTable,
} from "@workspace/db";
import { buildChildProfileConsentRecord } from "./child-profile-consent";
import { logger } from "./logger";
import { runtimeConfig } from "./runtime-config";
import { ensurePackagedClinicalKnowledge } from "./clinical-knowledge-bootstrap";

export const DEVELOPMENT_DEMO_COOKIE = "childled_development_demo";
export const DEVELOPMENT_DEMO_EMAIL = "demo.admin@childled.local";
export const DEVELOPMENT_CLINICIAN_EMAIL = "demo.clinician@childled.local";

const demoOrganization = { slug: "childled-demo", name: "ChildLed Demo" };
const demoAdmin = {
  id: "childled-development-demo-admin",
  displayName: "ChildLed Demo Administrator",
  email: DEVELOPMENT_DEMO_EMAIL,
};
const demoClinician = {
  id: "childled-development-demo-clinician",
  displayName: "Dr. Lena Ortiz",
  email: DEVELOPMENT_CLINICIAN_EMAIL,
};

const sampleGestalts = [
  {
    phrase: "Blast off!",
    meaning: "Excited about starting an activity.",
    communicationFunction: "Shared Joy",
    contexts: ["Home", "School"],
    emotionalState: "Excited",
    source: "Demo language sample",
  },
  {
    phrase: "To infinity and beyond",
    meaning: "Wants connection and shared play.",
    communicationFunction: "Request",
    contexts: ["Home", "Therapy"],
    emotionalState: "Regulated",
    source: "Demo language sample",
  },
  {
    phrase: "That's enough, thank you",
    meaning: "Asks for a pause when overwhelmed.",
    communicationFunction: "Self-Advocacy",
    contexts: ["Home", "School", "Community"],
    emotionalState: "Dysregulated",
    source: "Demo language sample",
  },
];

const sampleSessions = [
  {
    note: "Demo session: shared play and transition language",
    durationSeconds: 1320,
    clinicalObservations:
      "Oliver used familiar gestalts during a space-themed play routine and looked toward the clinician to share the moment.",
    nextSteps:
      "Continue modeling flexible combinations during preferred play and offer a visual transition cue.",
    gestaltPhrases: ["Blast off!", "To infinity and beyond"],
  },
  {
    note: "Demo session: self-advocacy during a sensory break",
    durationSeconds: 1080,
    clinicalObservations:
      "Oliver used a clear boundary-setting gestalt when the room became busy, then returned to the activity after a quiet break.",
    nextSteps:
      "Honor the self-advocacy phrase immediately and pair it with a simple visual choice for the next activity.",
    gestaltPhrases: ["That's enough, thank you"],
  },
];

type DevelopmentDemo = {
  organizationId: number;
  childId: number;
};

let bootstrapPromise: Promise<DevelopmentDemo> | undefined;

const normalizePhrase = (phrase: string) => phrase.trim().toLocaleLowerCase();

const ensureDevelopmentDemo = async (): Promise<DevelopmentDemo> => {
  if (!runtimeConfig.demoLogin.enabled) {
    throw new Error("Development demo data is unavailable.");
  }

  return db.transaction(async (tx) => {
    const existingOrganization = (
      await tx
        .select()
        .from(organizationsTable)
        .where(eq(organizationsTable.slug, demoOrganization.slug))
        .limit(1)
    )[0];
    const organization =
      existingOrganization ??
      (
        await tx.insert(organizationsTable).values(demoOrganization).returning()
      )[0];

    if (!organization)
      throw new Error("Could not create the development demo organization.");

    for (const user of [demoAdmin, demoClinician]) {
      await tx
        .insert(usersTable)
        .values({
          ...user,
          identityProvider: "development-demo",
          providerSubject: user.id,
        })
        .onConflictDoNothing();
    }

    await tx
      .insert(organizationMembershipsTable)
      .values({
        organizationId: organization.id,
        userId: demoAdmin.id,
        role: "admin",
        active: true,
      })
      .onConflictDoUpdate({
        target: [
          organizationMembershipsTable.organizationId,
          organizationMembershipsTable.userId,
        ],
        set: { role: "admin", active: true, updatedAt: new Date() },
      });
    await tx
      .insert(organizationMembershipsTable)
      .values({
        organizationId: organization.id,
        userId: demoClinician.id,
        role: "clinician",
        active: true,
      })
      .onConflictDoUpdate({
        target: [
          organizationMembershipsTable.organizationId,
          organizationMembershipsTable.userId,
        ],
        set: { role: "clinician", active: true, updatedAt: new Date() },
      });

    const existingChild = (
      await tx
        .select()
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.organizationId, organization.id),
            eq(childProfilesTable.displayName, "Oliver Bennett"),
            isNull(childProfilesTable.archivedAt),
          ),
        )
        .limit(1)
    )[0];
    const child =
      existingChild ??
      (
        await tx
          .insert(childProfilesTable)
          .values({
            organizationId: organization.id,
            displayName: "Oliver Bennett",
            dateOfBirth: "2019-03-14",
            school: "Maple Grove Elementary",
            grade: "1st grade",
            communicationStyle: "Gestalt Language Processor",
            profileDetails: {
              age: 7,
              aacSnapshot: {
                isUser: true,
                device: "TD I-110",
                vocabularySystem: "TD Snap Motor Plan 60",
                accessMethod: "Direct Touch",
                lastConfirmedAt: "2025-09-01",
              },
              glpNotes:
                "Oliver is beginning to combine shorter chunks and uses intonation to share excitement and uncertainty.",
              strengths: [
                "Strong memory for songs",
                "Notices tiny details",
                "Warm sense of humor",
              ],
              sensoryPreferences: [
                "Deep pressure",
                "Movement breaks",
                "Quiet corners",
              ],
              specialInterests: ["Space", "Trains", "Bluey"],
              regulationNotes:
                "Transitions are smoother when Oliver gets a two-minute warning and a visual cue.",
            },
          })
          .returning()
      )[0];

    if (!child)
      throw new Error("Could not create the development demo child profile.");
    const childDetails = child.profileDetails as Record<string, unknown>;
    if (!childDetails.aacSnapshot) {
      await tx
        .update(childProfilesTable)
        .set({
          profileDetails: {
            ...childDetails,
            aacSnapshot: {
              isUser: true,
              device: "TD I-110",
              vocabularySystem: "TD Snap Motor Plan 60",
              accessMethod: "Direct Touch",
              lastConfirmedAt: "2025-09-01",
            },
          },
        })
        .where(eq(childProfilesTable.id, child.id));
    }
    const demoAacValue: AacProfileHistoryValue = {
      communicationModalities: ["aac", "spoken_language", "gestures"],
      otherModalityLabel: null,
      aacUserStatus: "yes",
      deviceVendorId: "tobii_dynavox",
      deviceVendorCustomLabel: null,
      deviceModelId: "td_i_110",
      deviceModelCustomLabel: null,
      vocabularySystemId: "td_snap_motor_plan_60",
      vocabularySystemCustomLabel: null,
      accessMethodId: "direct_touch",
      accessMethodCustomLabel: null,
      ownershipId: "family_owned",
      ownershipCustomLabel: null,
      notes:
        "Device travels between home, school, and therapy. Keep descriptive information current with the care team.",
    };
    const [existingAacProfile] = await tx
      .select()
      .from(aacProfilesTable)
      .where(
        and(
          eq(aacProfilesTable.organizationId, organization.id),
          eq(aacProfilesTable.childId, child.id),
        ),
      )
      .limit(1);
    if (!existingAacProfile) {
      const confirmedAt = new Date();
      const [aacProfile] = await tx
        .insert(aacProfilesTable)
        .values({
          organizationId: organization.id,
          childId: child.id,
          ...demoAacValue,
          confirmedAt,
          confirmedByUserId: demoClinician.id,
          confirmedByName: demoClinician.displayName,
          confirmedByRole: "SLP",
          updatedByUserId: demoClinician.id,
          updatedByName: demoClinician.displayName,
          updatedByRole: "SLP",
        })
        .returning();
      if (aacProfile) {
        await tx.insert(aacProfileHistoryTable).values({
          organizationId: organization.id,
          childId: child.id,
          profileId: aacProfile.id,
          action: "created",
          previousModalities: null,
          nextModalities: ["aac", "spoken_language", "gestures"],
          previousOtherModalityLabel: null,
          nextOtherModalityLabel: null,
          changedFields: Object.keys(demoAacValue),
          previousValue: null,
          nextValue: demoAacValue,
          actorUserId: demoClinician.id,
          actorName: demoClinician.displayName,
          actorRole: "SLP",
        });
      }
    } else if (
      !existingAacProfile.removedAt &&
      existingAacProfile.aacUserStatus === "unknown" &&
      !existingAacProfile.deviceVendorId &&
      !existingAacProfile.deviceModelId &&
      !existingAacProfile.vocabularySystemId
    ) {
      const confirmedAt = new Date();
      await tx
        .update(aacProfilesTable)
        .set({
          ...demoAacValue,
          confirmedAt,
          confirmedByUserId: demoClinician.id,
          confirmedByName: demoClinician.displayName,
          confirmedByRole: "SLP",
          updatedByUserId: demoClinician.id,
          updatedByName: demoClinician.displayName,
          updatedByRole: "SLP",
          updatedAt: confirmedAt,
        })
        .where(eq(aacProfilesTable.id, existingAacProfile.id));
    }

    for (const member of [
      { userId: demoAdmin.id, role: "administrator" },
      { userId: demoClinician.id, role: "clinician" },
    ]) {
      await tx
        .insert(childCareTeamMembershipsTable)
        .values({
          childId: child.id,
          userId: member.userId,
          role: member.role,
          active: true,
        })
        .onConflictDoUpdate({
          target: [
            childCareTeamMembershipsTable.childId,
            childCareTeamMembershipsTable.userId,
          ],
          set: { role: member.role, active: true, updatedAt: new Date() },
        });
    }

    const consent = (
      await tx
        .select({ id: childProfileConsentRecordsTable.id })
        .from(childProfileConsentRecordsTable)
        .where(
          and(
            eq(childProfileConsentRecordsTable.childId, child.id),
            eq(childProfileConsentRecordsTable.userId, demoAdmin.id),
          ),
        )
        .limit(1)
    )[0];
    if (!consent) {
      await tx.insert(childProfileConsentRecordsTable).values(
        buildChildProfileConsentRecord({
          childId: child.id,
          userId: demoAdmin.id,
          confirmedBy: demoAdmin.displayName,
        }),
      );
    }

    for (const gestalt of sampleGestalts) {
      await tx
        .insert(clinicalGestaltsTable)
        .values({
          organizationId: organization.id,
          childId: child.id,
          phrase: gestalt.phrase,
          normalizedPhrase: normalizePhrase(gestalt.phrase),
          meaning: gestalt.meaning,
          communicationFunction: gestalt.communicationFunction,
          contexts: gestalt.contexts,
          emotionalState: gestalt.emotionalState,
          source: gestalt.source,
          createdByUserId: demoClinician.id,
        })
        .onConflictDoNothing();
    }

    const availableGestalts = await tx
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, organization.id),
          eq(clinicalGestaltsTable.childId, child.id),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      );

    for (const sampleSession of sampleSessions) {
      const existingSession = (
        await tx
          .select()
          .from(therapySessionsTable)
          .where(
            and(
              eq(therapySessionsTable.organizationId, organization.id),
              eq(therapySessionsTable.childId, child.id),
              eq(therapySessionsTable.note, sampleSession.note),
              isNull(therapySessionsTable.archivedAt),
            ),
          )
          .limit(1)
      )[0];
      if (existingSession) continue;

      const [session] = await tx
        .insert(therapySessionsTable)
        .values({
          organizationId: organization.id,
          childId: child.id,
          durationSeconds: sampleSession.durationSeconds,
          clinicalObservations: sampleSession.clinicalObservations,
          nextSteps: sampleSession.nextSteps,
          note: sampleSession.note,
          createdByUserId: demoClinician.id,
        })
        .returning();

      if (!session)
        throw new Error("Could not create a development demo therapy session.");

      const sessionGestalts = availableGestalts.filter((gestalt) =>
        sampleSession.gestaltPhrases.includes(gestalt.phrase),
      );
      if (sessionGestalts.length) {
        await tx.insert(therapySessionGestaltsTable).values(
          sessionGestalts.map((gestalt) => ({
            sessionId: session.id,
            gestaltId: gestalt.id,
            phrase: gestalt.phrase,
            meaning: gestalt.meaning,
            communicationFunction: gestalt.communicationFunction,
            context: "Therapy",
            emotionalState: gestalt.emotionalState,
            note: "Included in the development demo session.",
          })),
        );
      }
    }

    return { organizationId: organization.id, childId: child.id };
  });
};

export const seedDevelopmentDemo = async () => {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureDevelopmentDemo()
      .then(async (demo) => {
        await ensurePackagedClinicalKnowledge(
          demo.organizationId,
          demoAdmin.id,
        );
        return demo;
      })
      .catch((error) => {
        bootstrapPromise = undefined;
        throw error;
      });
  }
  return bootstrapPromise;
};

const developmentSpeakerFixtureCharacteristic = (
  speaker: "child" | "clinician",
) =>
  createHash("sha256")
    .update(`childled-development-speaker-fixture:${speaker}`, "utf8")
    .digest("hex");

/**
 * Creates a fresh, development-only transcript for exercising the protected
 * speaker-review UI. The database receives only hashes of synthetic provider
 * characteristics, and the response is shaped through transcriptResponse
 * before it can reach the browser.
 */
export const seedDevelopmentSpeakerReviewFixture = async (target?: {
  organizationId: number;
  childId: number;
  createdByUserId: string;
  createdBy: string;
}) => {
  if (!runtimeConfig.demoLogin.enabled) {
    throw new Error("Development speaker fixtures are unavailable.");
  }

  const demo = await seedDevelopmentDemo();
  const organizationId = target?.organizationId ?? demo.organizationId;
  const childId = target?.childId ?? demo.childId;
  const createdByUserId = target?.createdByUserId ?? demoClinician.id;
  const createdBy = target?.createdBy ?? demoClinician.displayName;
  if (organizationId !== demo.organizationId) {
    throw new Error(
      "Development speaker fixtures must stay inside the demo organization.",
    );
  }
  const childCharacteristicHash =
    developmentSpeakerFixtureCharacteristic("child");
  const clinicianCharacteristicHash =
    developmentSpeakerFixtureCharacteristic("clinician");

  return db.transaction(async (tx) => {
    // Reset the "new speaker" side of the fixture without deleting its audit
    // history, so repeated browser runs always begin with a remember action.
    await tx
      .update(childSpeakerProfilesTable)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(childSpeakerProfilesTable.childId, childId),
          eq(
            childSpeakerProfilesTable.profileSignatureHash,
            clinicianCharacteristicHash,
          ),
          isNull(childSpeakerProfilesTable.archivedAt),
        ),
      );

    await tx
      .insert(childSpeakerProfilesTable)
      .values({
        organizationId,
        childId,
        profileSignatureHash: childCharacteristicHash,
        role: "child",
        confidenceScore: 98,
        createdByUserId: demoClinician.id,
        reviewedAt: new Date(),
        archivedAt: null,
      })
      .onConflictDoUpdate({
        target: [
          childSpeakerProfilesTable.childId,
          childSpeakerProfilesTable.profileSignatureHash,
        ],
        set: {
          organizationId,
          role: "child",
          confidenceScore: 98,
          createdByUserId: demoClinician.id,
          reviewedAt: new Date(),
          archivedAt: null,
          updatedAt: new Date(),
        },
      });

    const [transcript] = await tx
      .insert(sessionTranscriptsTable)
      .values({
        childId,
        audioId: `development-speaker-review-${randomUUID()}`,
        createdBy,
        createdByUserId,
        status: "complete",
        provider: "development-demo:speaker-review-fixture",
        rawTranscript: [
          "Speaker A: Blast off!",
          "Speaker B: Let’s build a rocket together.",
          "Speaker A: Again!",
        ].join("\n"),
        speakerSeparationStatus: "complete",
      })
      .returning();

    if (!transcript) {
      throw new Error(
        "Could not create the development speaker-review transcript.",
      );
    }

    await tx.insert(transcriptSpeakerSegmentsTable).values([
      {
        transcriptId: transcript.id,
        speakerLabel: "Speaker A",
        text: "Blast off!",
        position: 0,
        speakerConfidence: "high",
        speakerConfidenceScore: 98,
        profileSignatureHash: childCharacteristicHash,
      },
      {
        transcriptId: transcript.id,
        speakerLabel: "Speaker B",
        text: "Let’s build a rocket together.",
        position: 1,
        speakerConfidence: "medium",
        speakerConfidenceScore: 65,
        profileSignatureHash: clinicianCharacteristicHash,
      },
      {
        transcriptId: transcript.id,
        speakerLabel: "Speaker A",
        text: "Again!",
        position: 2,
        speakerConfidence: "high",
        speakerConfidenceScore: 98,
        profileSignatureHash: childCharacteristicHash,
      },
    ]);

    return transcript;
  });
};

export const attachDevelopmentDemoActor = async (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  if (
    !runtimeConfig.demoLogin.enabled ||
    request.childledActor ||
    request.cookies?.[DEVELOPMENT_DEMO_COOKIE] !== "active"
  ) {
    return next();
  }

  try {
    const demo = await seedDevelopmentDemo();
    const assignedChildren = await db
      .select({ childId: childCareTeamMembershipsTable.childId })
      .from(childCareTeamMembershipsTable)
      .where(
        and(
          eq(childCareTeamMembershipsTable.userId, demoAdmin.id),
          eq(childCareTeamMembershipsTable.active, true),
        ),
      );
    request.childledActor = {
      userId: demoAdmin.id,
      author: demoAdmin.displayName,
      role: "Administrator",
      childIds: assignedChildren.map((membership) => membership.childId),
      isAdmin: true,
      isSuperAdmin: true,
      isDevelopmentDemo: true,
      organizationId: demo.organizationId,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    };
    request.childledAuthFailure = undefined;
  } catch (error) {
    request.childledAuthFailure = "session_invalid";
    logger.error({ err: error }, "Could not prepare the development demo");
  }
  return next();
};
