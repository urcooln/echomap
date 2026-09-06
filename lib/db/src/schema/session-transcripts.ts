import {
  boolean,
  check,
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
import { childProfilesTable, organizationsTable, usersTable } from "./core-domain";

export const sessionTranscriptsTable = pgTable(
  "session_transcripts",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id").notNull(),
    audioId: text("audio_id").notNull(),
    sessionId: integer("session_id"),
    createdBy: text("created_by").notNull(),
    createdByUserId: text("created_by_user_id")
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("processing"),
    provider: text("provider").notNull().default("openai:gpt-4o-mini-transcribe"),
    rawTranscript: text("raw_transcript").notNull().default(""),
    speakerSeparationStatus: text("speaker_separation_status").notNull().default("pending"),
    speakerSeparationAttempt: integer("speaker_separation_attempt").notNull().default(0),
    speakerSeparationStartedAt: timestamp("speaker_separation_started_at", { withTimezone: true }),
    speakerSeparationCompletedAt: timestamp("speaker_separation_completed_at", { withTimezone: true }),
    speakerSeparationFailureCode: text("speaker_separation_failure_code"),
    speakerSeparationFailureMessage: text("speaker_separation_failure_message"),
    errorMessage: text("error_message"),
    occurrenceAppliedAt: timestamp("occurrence_applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("session_transcripts_audio_id_unique").on(table.audioId),
    index("session_transcripts_owner_child_draft_idx").on(
      table.createdByUserId,
      table.childId,
      table.sessionId,
      table.updatedAt,
    ),
  ],
);

/**
 * Mixed-speaker phrase prompts created from the raw transcript before speaker
 * attribution. This table is intentionally separate from transcript_phrases:
 * no row here is clinical evidence or eligible for dictionary/analytics use.
 */
export const transcriptProvisionalPhrasesTable = pgTable(
  "transcript_provisional_phrases",
  {
    id: serial("id").primaryKey(),
    transcriptId: integer("transcript_id")
      .notNull()
      .references(() => sessionTranscriptsTable.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    frequency: integer("frequency").notNull().default(1),
    candidateKind: text("candidate_kind").notNull().default("potential_phrase"),
    disposition: text("disposition").notNull().default("pending"),
    workingMeaning: text("working_meaning"),
    reviewedByUserId: text("reviewed_by_user_id")
      .references(() => usersTable.id, { onDelete: "restrict" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("transcript_provisional_phrases_transcript_idx").on(
      table.transcriptId,
      table.updatedAt,
    ),
  ],
);

export const transcriptPhrasesTable = pgTable(
  "transcript_phrases",
  {
    id: serial("id").primaryKey(),
    transcriptId: integer("transcript_id")
      .notNull()
      .references(() => sessionTranscriptsTable.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    frequency: integer("frequency").notNull().default(1),
    matchedGestaltId: integer("matched_gestalt_id"),
    accepted: boolean("accepted").notNull().default(true),
    /**
     * Server-derived role of the source speech when the phrase was built.
     * Candidate phrases must be rebuilt after speaker review; pending and
     * unassigned transcript material remains ineligible for clinical use.
     */
    attributedRole: text("attributed_role").notNull().default("unassigned"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("transcript_phrases_transcript_phrase_unique").on(
      table.transcriptId,
      table.normalizedPhrase,
    ),
  ],
);

export const transcriptSpeakerSegmentsTable = pgTable(
  "transcript_speaker_segments",
  {
    id: serial("id").primaryKey(),
    transcriptId: integer("transcript_id")
      .notNull()
      .references(() => sessionTranscriptsTable.id, { onDelete: "cascade" }),
    speakerLabel: text("speaker_label").notNull(),
    text: text("text").notNull(),
    position: integer("position").notNull(),
    speakerConfidence: text("speaker_confidence").notNull().default("low"),
    speakerConfidenceScore: integer("speaker_confidence_score"),
    intelligibility: text("intelligibility").notNull().default("intelligible"),
    transcriptionConfidenceScore: integer("transcription_confidence_score"),
    startTimeMilliseconds: integer("start_time_milliseconds"),
    durationMilliseconds: integer("duration_milliseconds"),
    profileSignatureHash: text("profile_signature_hash"),
    speakerReviewed: boolean("speaker_reviewed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("transcript_speaker_segments_position_unique").on(
      table.transcriptId,
      table.position,
    ),
  ],
);

/**
 * A clinician's review of one transcript segment after its speaker role has
 * been confirmed as Child. The transcript and attribution stay immutable; this
 * table only records how the utterance should participate in clinical review.
 */
export const transcriptChildUtteranceReviewsTable = pgTable(
  "transcript_child_utterance_reviews",
  {
    id: serial("id").primaryKey(),
    transcriptId: integer("transcript_id")
      .notNull()
      .references(() => sessionTranscriptsTable.id, { onDelete: "cascade" }),
    segmentId: integer("segment_id")
      .notNull()
      .references(() => transcriptSpeakerSegmentsTable.id, { onDelete: "cascade" }),
    disposition: text("disposition").notNull().default("pending"),
    intelligibilityReviewStatus: text("intelligibility_review_status").notNull().default("pending"),
    context: text("context"),
    meaning: text("meaning"),
    interpretation: text("interpretation"),
    note: text("note"),
    crossSessionLabel: text("cross_session_label"),
    nlaStage: text("nla_stage"),
    nlaStageAssignedByUserId: text("nla_stage_assigned_by_user_id")
      .references(() => usersTable.id, { onDelete: "restrict" }),
    nlaStageAssignedByRole: text("nla_stage_assigned_by_role"),
    nlaStageAssignedAt: timestamp("nla_stage_assigned_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("transcript_child_utterance_reviews_segment_unique").on(
      table.transcriptId,
      table.segmentId,
    ),
    index("transcript_child_utterance_reviews_transcript_idx").on(table.transcriptId),
    check(
      "transcript_child_utterance_reviews_nla_stage_check",
      sql`${table.nlaStage} is null or ${table.nlaStage} in ('stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_4_plus')`,
    ),
  ],
);

export const childSpeakerRolesTable = pgTable(
  "child_speaker_roles",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id").notNull(),
    speakerLabel: text("speaker_label").notNull(),
    role: text("role").notNull().default("unassigned"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_speaker_roles_child_speaker_unique").on(
      table.childId,
      table.speakerLabel,
    ),
  ],
);

/**
 * A clinician-approved, child-scoped speaker profile. The application stores
 * only a one-way hash of an opaque provider characteristic; it never stores
 * raw audio, a voiceprint, or a person's name.
 */
export const childSpeakerProfilesTable = pgTable(
  "child_speaker_profiles",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "cascade" }),
    profileSignatureHash: text("profile_signature_hash").notNull(),
    role: text("role").notNull().default("unknown"),
    confidenceScore: integer("confidence_score"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_speaker_profiles_child_signature_unique").on(
      table.childId,
      table.profileSignatureHash,
    ),
    index("child_speaker_profiles_org_child_active_idx").on(
      table.organizationId,
      table.childId,
      table.archivedAt,
    ),
  ],
);

/**
 * Clinician-reviewed speaker roles are scoped to one transcript. Temporary
 * labels such as "Speaker A" are not reliable identities across recordings.
 */
export const transcriptSpeakerRolesTable = pgTable(
  "transcript_speaker_roles",
  {
    id: serial("id").primaryKey(),
    transcriptId: integer("transcript_id")
      .notNull()
      .references(() => sessionTranscriptsTable.id, { onDelete: "cascade" }),
    speakerLabel: text("speaker_label").notNull(),
    role: text("role").notNull().default("unassigned"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("transcript_speaker_roles_transcript_speaker_unique").on(
      table.transcriptId,
      table.speakerLabel,
    ),
  ],
);

/**
 * Reproducible role-review guidance for a temporary transcript cluster. It
 * contains no raw audio, transcript text, voiceprint, or identity material.
 */
export const transcriptSpeakerRoleInferencesTable = pgTable(
  "transcript_speaker_role_inferences",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "cascade" }),
    transcriptId: integer("transcript_id")
      .notNull()
      .references(() => sessionTranscriptsTable.id, { onDelete: "cascade" }),
    speakerLabel: text("speaker_label").notNull(),
    state: text("state").notNull(),
    predictedRole: text("predicted_role"),
    confidenceScore: integer("confidence_score"),
    competingRole: text("competing_role"),
    competingScore: integer("competing_score"),
    margin: integer("margin"),
    signalCount: integer("signal_count").notNull().default(0),
    signalSummary: jsonb("signal_summary").$type<Array<Record<string, unknown>>>().notNull().default([]),
    inputFingerprint: text("input_fingerprint").notNull(),
    modelVersion: text("model_version").notNull(),
    featureVersion: text("feature_version").notNull(),
    confirmedRole: text("confirmed_role"),
    confirmedByUserId: text("confirmed_by_user_id")
      .references(() => usersTable.id, { onDelete: "restrict" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("transcript_speaker_role_inferences_transcript_label_unique").on(
      table.transcriptId,
      table.speakerLabel,
    ),
    index("transcript_speaker_role_inferences_org_child_idx").on(
      table.organizationId,
      table.childId,
      table.updatedAt,
    ),
  ],
);

/**
 * Bounded outcome counts from clinician-confirmed assignments. These are
 * review guidance rather than an online identity or biometric model.
 */
export const childSpeakerRoleLearningAggregatesTable = pgTable(
  "child_speaker_role_learning_aggregates",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    featureKey: text("feature_key").notNull(),
    confirmedCount: integer("confirmed_count").notNull().default(0),
    modelVersion: text("model_version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_speaker_role_learning_org_child_role_feature_unique").on(
      table.organizationId,
      table.childId,
      table.role,
      table.featureKey,
    ),
  ],
);

/**
 * Immutable audit records for the legal-authority confirmation made before
 * creating a child profile. Child profiles are currently held by the ChildLed
 * service, so this intentionally does not use a foreign key.
 */
export const childProfileConsentRecordsTable = pgTable(
  "child_profile_consent_records",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id").notNull(),
    userId: text("user_id").notNull(),
    confirmedBy: text("confirmed_by").notNull(),
    statementVersion: text("statement_version").notNull(),
    statement: text("statement").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("child_profile_consent_records_child_id_idx").on(table.childId),
    index("child_profile_consent_records_user_id_idx").on(table.userId),
  ],
);

export const gestaltOccurrencesTable = pgTable(
  "gestalt_occurrences",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id").notNull(),
    gestaltId: integer("gestalt_id"),
    phrase: text("phrase").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    occurrenceCount: integer("occurrence_count").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("gestalt_occurrences_child_phrase_unique").on(
      table.childId,
      table.normalizedPhrase,
    ),
  ],
);

export const insertSessionTranscriptSchema = createInsertSchema(sessionTranscriptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTranscriptPhraseSchema = createInsertSchema(transcriptPhrasesTable).omit({
  id: true,
  createdAt: true,
});
export const insertTranscriptProvisionalPhraseSchema = createInsertSchema(
  transcriptProvisionalPhrasesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTranscriptSpeakerSegmentSchema = createInsertSchema(
  transcriptSpeakerSegmentsTable,
).omit({
  id: true,
  createdAt: true,
});
export const insertTranscriptChildUtteranceReviewSchema = createInsertSchema(
  transcriptChildUtteranceReviewsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertChildSpeakerRoleSchema = createInsertSchema(childSpeakerRolesTable).omit({
  id: true,
  updatedAt: true,
});
export const insertChildSpeakerProfileSchema = createInsertSchema(childSpeakerProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTranscriptSpeakerRoleSchema = createInsertSchema(
  transcriptSpeakerRolesTable,
).omit({
  id: true,
  updatedAt: true,
});
export const insertTranscriptSpeakerRoleInferenceSchema = createInsertSchema(
  transcriptSpeakerRoleInferencesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertChildSpeakerRoleLearningAggregateSchema = createInsertSchema(
  childSpeakerRoleLearningAggregatesTable,
).omit({
  id: true,
  updatedAt: true,
});
export const insertChildProfileConsentRecordSchema = createInsertSchema(
  childProfileConsentRecordsTable,
).omit({
  id: true,
  createdAt: true,
});
export const insertGestaltOccurrenceSchema = createInsertSchema(gestaltOccurrencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSessionTranscript = z.infer<typeof insertSessionTranscriptSchema>;
export type SessionTranscriptRecord = typeof sessionTranscriptsTable.$inferSelect;
export type InsertTranscriptPhrase = z.infer<typeof insertTranscriptPhraseSchema>;
export type TranscriptPhraseRecord = typeof transcriptPhrasesTable.$inferSelect;
export type InsertTranscriptProvisionalPhrase = z.infer<
  typeof insertTranscriptProvisionalPhraseSchema
>;
export type TranscriptProvisionalPhraseRecord =
  typeof transcriptProvisionalPhrasesTable.$inferSelect;
export type InsertTranscriptSpeakerSegment = z.infer<typeof insertTranscriptSpeakerSegmentSchema>;
export type TranscriptSpeakerSegmentRecord = typeof transcriptSpeakerSegmentsTable.$inferSelect;
export type InsertTranscriptChildUtteranceReview = z.infer<
  typeof insertTranscriptChildUtteranceReviewSchema
>;
export type TranscriptChildUtteranceReviewRecord =
  typeof transcriptChildUtteranceReviewsTable.$inferSelect;
export type InsertChildSpeakerRole = z.infer<typeof insertChildSpeakerRoleSchema>;
export type ChildSpeakerRoleRecord = typeof childSpeakerRolesTable.$inferSelect;
export type InsertChildSpeakerProfile = z.infer<typeof insertChildSpeakerProfileSchema>;
export type ChildSpeakerProfileRecord = typeof childSpeakerProfilesTable.$inferSelect;
export type TranscriptSpeakerRoleRecord = typeof transcriptSpeakerRolesTable.$inferSelect;
export type TranscriptSpeakerRoleInferenceRecord =
  typeof transcriptSpeakerRoleInferencesTable.$inferSelect;
export type ChildSpeakerRoleLearningAggregateRecord =
  typeof childSpeakerRoleLearningAggregatesTable.$inferSelect;
export type InsertChildProfileConsentRecord = z.infer<typeof insertChildProfileConsentRecordSchema>;
export type ChildProfileConsentRecord = typeof childProfileConsentRecordsTable.$inferSelect;
export type InsertGestaltOccurrence = z.infer<typeof insertGestaltOccurrenceSchema>;
export type GestaltOccurrenceRecord = typeof gestaltOccurrencesTable.$inferSelect;
