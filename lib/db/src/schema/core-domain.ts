import { randomInt } from "node:crypto";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const CHILD_LED_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const CHILD_LED_ID_PATTERN = /^CLID-[A-Z0-9]{6}$/;

export const generateChildLedId = () =>
  `CLID-${Array.from(
    { length: 6 },
    () => CHILD_LED_ID_ALPHABET[randomInt(CHILD_LED_ID_ALPHABET.length)],
  ).join("")}`;

export const applicationRoleValues = [
  "clinician",
  "parent",
  "teacher",
  "admin",
] as const;

export const organizationsTable = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Emergency access boundary. Disabled organizations cannot issue or consume invitations. */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    disabledReason: text("disabled_reason"),
    /** Private-beta approval and optional cohort/capacity controls. */
    betaApprovedAt: timestamp("beta_approved_at", { withTimezone: true }),
    betaCohort: text("beta_cohort"),
    betaUserLimit: integer("beta_user_limit"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)],
);

export const usersTable = pgTable(
  "users",
  {
    // This is an application-owned opaque ID, not an OIDC subject.
    id: text("id").primaryKey(),
    identityProvider: text("identity_provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    disabledReason: text("disabled_reason"),
    betaApprovedAt: timestamp("beta_approved_at", { withTimezone: true }),
    betaCohort: text("beta_cohort"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_provider_subject_unique").on(
      table.identityProvider,
      table.providerSubject,
    ),
    index("users_email_idx").on(table.email),
  ],
);

export const organizationMembershipsTable = pgTable(
  "organization_memberships",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
    /**
     * `active` remains the administrative enable/disable switch. Account
     * status separately prevents a provisioned invitee from using the
     * workspace until role-specific onboarding is complete.
     */
    accountStatus: text("account_status").notNull().default("active"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_memberships_user_active_idx").on(
      table.userId,
      table.active,
    ),
  ],
);

export const childProfilesTable = pgTable(
  "child_profiles",
  {
    id: serial("id").primaryKey(),
    childLedId: text("child_led_id").notNull().$defaultFn(generateChildLedId),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    preferredName: text("preferred_name").notNull().default(""),
    pronouns: text("pronouns"),
    dateOfBirth: text("date_of_birth"),
    school: text("school").notNull().default(""),
    grade: text("grade").notNull().default(""),
    communicationStyle: text("communication_style").notNull().default(""),
    profileDetails: jsonb("profile_details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_profiles_child_led_id_lower_unique").on(
      sql`lower(${table.childLedId})`,
    ),
    check(
      "child_profiles_child_led_id_format_check",
      sql`${table.childLedId} ~ '^CLID-[A-Z0-9]{6}$'`,
    ),
    index("child_profiles_org_active_idx").on(
      table.organizationId,
      table.archivedAt,
    ),
  ],
);

export const childCareTeamMembershipsTable = pgTable(
  "child_care_team_memberships",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    primaryServiceDeliveryType: text("primary_service_delivery_type")
      .notNull()
      .default("individual"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_care_team_child_user_unique").on(
      table.childId,
      table.userId,
    ),
    index("child_care_team_user_active_idx").on(table.userId, table.active),
  ],
);

export const iepServiceRequirementsTable = pgTable(
  "iep_service_requirements",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    serviceType: text("service_type").notNull().default("individual"),
    serviceName: text("service_name").notNull(),
    normalizedServiceName: text("normalized_service_name").notNull(),
    requiredSessions: integer("required_sessions").notNull(),
    requiredMinutes: integer("required_minutes").notNull(),
    sessionDurationMinutes: integer("session_duration_minutes").notNull(),
    period: text("period").notNull(),
    customFrequencyDescription: text("custom_frequency_description"),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("iep_service_requirements_child_service_idx").on(
      table.organizationId,
      table.childId,
      table.serviceType,
      table.effectiveFrom,
    ),
    index("iep_service_requirements_child_status_idx").on(
      table.organizationId,
      table.childId,
      table.status,
    ),
  ],
);

export const clinicalGestaltsTable = pgTable(
  "clinical_gestalts",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    phrase: text("phrase").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    meaning: text("meaning").notNull(),
    communicationFunction: text("communication_function").notNull(),
    contexts: jsonb("contexts").$type<string[]>().notNull().default([]),
    emotionalState: text("emotional_state").notNull(),
    source: text("source").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("clinical_gestalts_child_phrase_unique")
      .on(table.childId, table.normalizedPhrase)
      .where(sql`${table.archivedAt} IS NULL`),
    index("clinical_gestalts_org_child_active_idx").on(
      table.organizationId,
      table.childId,
      table.archivedAt,
    ),
  ],
);

export const clinicalObservationsTable = pgTable(
  "clinical_observations",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    context: text("context").notNull().default(""),
    /**
     * A private, finalized App Storage object. Browser-writable staging paths
     * are never persisted here or served to a care-team member.
     */
    videoObjectPath: text("video_object_path"),
    videoContentType: text("video_content_type"),
    videoSizeBytes: integer("video_size_bytes"),
    videoConsentConfirmedAt: timestamp("video_consent_confirmed_at", {
      withTimezone: true,
    }),
    videoConsentConfirmedByUserId: text(
      "video_consent_confirmed_by_user_id",
    ).references(() => usersTable.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("clinical_observations_org_child_created_idx").on(
      table.organizationId,
      table.childId,
      table.createdAt,
    ),
  ],
);

/**
 * Durable lifecycle record for a browser-uploaded home observation video.
 * The browser receives only a short-lived signed URL; the app later promotes
 * the staging object and records the final object only after validation.
 */
export const observationVideoUploadsTable = pgTable(
  "observation_video_uploads",
  {
    id: text("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    observationId: integer("observation_id").references(
      () => clinicalObservationsTable.id,
      { onDelete: "cascade" },
    ),
    stagingObjectPath: text("staging_object_path").notNull(),
    finalObjectPath: text("final_object_path"),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    consentConfirmedAt: timestamp("consent_confirmed_at", {
      withTimezone: true,
    }).notNull(),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("reserved"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attachedAt: timestamp("attached_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("observation_video_uploads_staging_path_unique").on(
      table.stagingObjectPath,
    ),
    index("observation_video_uploads_org_child_status_idx").on(
      table.organizationId,
      table.childId,
      table.status,
    ),
    index("observation_video_uploads_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const therapySessionsTable = pgTable(
  "therapy_sessions",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    serviceRequirementId: integer("service_requirement_id").references(
      () => iepServiceRequirementsTable.id,
      { onDelete: "restrict" },
    ),
    sessionMode: text("session_mode").notNull().default("recorded"),
    sessionStatus: text("session_status").notNull().default("completed"),
    missedReason: text("missed_reason"),
    missedReasonDetail: text("missed_reason_detail"),
    makeupStatus: text("makeup_status"),
    makeupForSessionId: integer("makeup_for_session_id").references(
      (): AnyPgColumn => therapySessionsTable.id,
      { onDelete: "restrict" },
    ),
    sessionDate: date("session_date", { mode: "string" })
      .notNull()
      .default(sql`CURRENT_DATE`),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    durationSource: text("duration_source").notNull().default("recording"),
    durationEdited: boolean("duration_edited").notNull().default(false),
    clinicalObservations: text("clinical_observations").notNull().default(""),
    nextSteps: text("next_steps").notNull().default(""),
    note: text("note").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("therapy_sessions_org_child_created_idx").on(
      table.organizationId,
      table.childId,
      table.createdAt,
    ),
    index("therapy_sessions_service_date_idx").on(
      table.organizationId,
      table.serviceRequirementId,
      table.sessionDate,
    ),
    uniqueIndex("therapy_sessions_makeup_for_unique")
      .on(table.makeupForSessionId)
      .where(
        sql`${table.makeupForSessionId} is not null and ${table.archivedAt} is null`,
      ),
  ],
);

export const therapySessionGestaltsTable = pgTable(
  "therapy_session_gestalts",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => therapySessionsTable.id, { onDelete: "cascade" }),
    gestaltId: integer("gestalt_id").references(
      () => clinicalGestaltsTable.id,
      { onDelete: "set null" },
    ),
    transcriptPhraseId: integer("transcript_phrase_id"),
    phraseInboxItemId: integer("phrase_inbox_item_id"),
    /**
     * Immutable, server-derived eligibility marker for Child-only clinical
     * evidence. SOAP and occurrence analytics must filter on this marker.
     */
    childAttributed: boolean("child_attributed").notNull().default(false),
    phrase: text("phrase").notNull(),
    meaning: text("meaning").notNull(),
    communicationFunction: text("communication_function").notNull(),
    context: text("context").notNull(),
    emotionalState: text("emotional_state").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("therapy_session_gestalts_session_idx").on(table.sessionId),
  ],
);

export const audioObjectStatusValues = [
  "staged",
  "ready",
  "attached",
  "deleted",
  "failed",
] as const;
export const sessionAudioPurposeValues = [
  "session_recording",
  "speaker_calibration",
  "unintelligible_clip",
] as const;
export const calibrationRoleValues = ["clinician", "caregiver"] as const;
export const sessionPreparationStatusValues = [
  "active",
  "ready",
  "completed",
  "revoked",
  "expired",
] as const;

export const sessionRecordingPreparationsTable = pgTable(
  "session_recording_preparations",
  {
    id: text("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("session_recording_preparations_owner_idx").on(
      table.organizationId,
      table.childId,
      table.createdByUserId,
      table.status,
    ),
  ],
);

export const sessionAudioObjectsTable = pgTable(
  "session_audio_objects",
  {
    id: text("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sessionId: integer("session_id").references(() => therapySessionsTable.id, {
      onDelete: "set null",
    }),
    preparationId: text("preparation_id").references(
      () => sessionRecordingPreparationsTable.id,
      { onDelete: "set null" },
    ),
    purpose: text("purpose").notNull().default("session_recording"),
    sourceTranscriptSegmentId: integer("source_transcript_segment_id"),
    calibrationRole: text("calibration_role"),
    durationMilliseconds: integer("duration_milliseconds"),
    storageDriver: text("storage_driver").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").notNull().default("staged"),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    consentConfirmedAt: timestamp("consent_confirmed_at", {
      withTimezone: true,
    }).notNull(),
    consentConfirmedByUserId: text("consent_confirmed_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("session_audio_objects_driver_key_unique").on(
      table.storageDriver,
      table.objectKey,
    ),
    index("session_audio_objects_org_child_status_idx").on(
      table.organizationId,
      table.childId,
      table.status,
    ),
    index("session_audio_objects_session_idx").on(table.sessionId),
    index("session_audio_objects_preparation_idx").on(table.preparationId),
    uniqueIndex("session_audio_objects_source_segment_unique")
      .on(table.sourceTranscriptSegmentId)
      .where(
        sql`${table.sourceTranscriptSegmentId} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
  ],
);

export const insertOrganizationSchema = createInsertSchema(
  organizationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertOrganizationMembershipSchema = createInsertSchema(
  organizationMembershipsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChildProfileSchema = createInsertSchema(
  childProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChildCareTeamMembershipSchema = createInsertSchema(
  childCareTeamMembershipsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIepServiceRequirementSchema = createInsertSchema(
  iepServiceRequirementsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClinicalGestaltSchema = createInsertSchema(
  clinicalGestaltsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClinicalObservationSchema = createInsertSchema(
  clinicalObservationsTable,
).omit({ id: true, createdAt: true });
export const insertObservationVideoUploadSchema = createInsertSchema(
  observationVideoUploadsTable,
).omit({ createdAt: true, updatedAt: true });
export const insertTherapySessionSchema = createInsertSchema(
  therapySessionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTherapySessionGestaltSchema = createInsertSchema(
  therapySessionGestaltsTable,
).omit({ id: true, createdAt: true });
export const insertSessionAudioObjectSchema = createInsertSchema(
  sessionAudioObjectsTable,
).omit({ createdAt: true });
export const insertSessionRecordingPreparationSchema = createInsertSchema(
  sessionRecordingPreparationsTable,
).omit({ createdAt: true, completedAt: true, revokedAt: true });

export type ApplicationRole = (typeof applicationRoleValues)[number];
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganizationMembership = z.infer<
  typeof insertOrganizationMembershipSchema
>;
export type InsertChildProfile = z.infer<typeof insertChildProfileSchema>;
export type InsertChildCareTeamMembership = z.infer<
  typeof insertChildCareTeamMembershipSchema
>;
export type IepServiceRequirement =
  typeof iepServiceRequirementsTable.$inferSelect;
export type InsertClinicalGestalt = z.infer<typeof insertClinicalGestaltSchema>;
export type InsertClinicalObservation = z.infer<
  typeof insertClinicalObservationSchema
>;
export type InsertObservationVideoUpload = z.infer<
  typeof insertObservationVideoUploadSchema
>;
export type InsertTherapySession = z.infer<typeof insertTherapySessionSchema>;
export type InsertTherapySessionGestalt = z.infer<
  typeof insertTherapySessionGestaltSchema
>;
export type InsertSessionAudioObject = z.infer<
  typeof insertSessionAudioObjectSchema
>;
export type InsertSessionRecordingPreparation = z.infer<
  typeof insertSessionRecordingPreparationSchema
>;
export type SessionAudioPurpose = (typeof sessionAudioPurposeValues)[number];
export type CalibrationRole = (typeof calibrationRoleValues)[number];
