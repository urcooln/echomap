import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  childProfilesTable,
  clinicalGestaltsTable,
  organizationsTable,
  therapySessionsTable,
  usersTable,
} from "./core-domain";

export type KnowledgeSourceTags = string[];
export type KnowledgeCitation = {
  sourceId: number;
  sourceVersionId: number;
  chunkId: number;
  sourceTitle: string;
  page: number | null;
  section: string | null;
};
export type KnowledgeEvidenceSnapshot = {
  reviewedPhraseCount: number;
  reviewedObservationCount: number;
  sessionId: number | null;
  phrase: string | null;
  evidenceVersion: string;
};
export type InsightAlternatives = string[];

export const clinicalKnowledgeInsightRunsTable = pgTable(
  "clinical_knowledge_insight_runs",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id").notNull().references(() => childProfilesTable.id, { onDelete: "restrict" }),
    triggerSessionId: integer("trigger_session_id").references(() => therapySessionsTable.id, { onDelete: "set null" }),
    triggeredByUserId: text("triggered_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    evidenceFingerprint: text("evidence_fingerprint").notNull(),
    knowledgeFingerprint: text("knowledge_fingerprint").notNull(),
    engineVersion: text("engine_version").notNull(),
    status: text("status").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(0),
    failureCode: text("failure_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("clinical_knowledge_insight_run_fingerprint_unique").on(
      table.organizationId, table.childId, table.evidenceFingerprint, table.knowledgeFingerprint, table.engineVersion,
    ),
    index("clinical_knowledge_insight_runs_org_child_idx").on(table.organizationId, table.childId, table.createdAt),
  ],
);

export const clinicalKnowledgeAppliedFactsTable = pgTable(
  "clinical_knowledge_applied_facts",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id").notNull().references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sessionId: integer("session_id").references(() => therapySessionsTable.id, { onDelete: "set null" }),
    runId: integer("run_id").notNull().references(() => clinicalKnowledgeInsightRunsTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    gestaltId: integer("gestalt_id").references(() => clinicalGestaltsTable.id, { onDelete: "set null" }),
    engineCreatedGestalt: boolean("engine_created_gestalt").notNull().default(false),
    normalizedPhrase: text("normalized_phrase").notNull(),
    phrase: text("phrase").notNull(),
    meaning: text("meaning").notNull(),
    communicationFunction: text("communication_function").notNull(),
    contexts: jsonb("contexts").$type<string[]>().notNull().default([]),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    confidence: text("confidence").notNull(),
    citations: jsonb("citations").$type<KnowledgeCitation[]>().notNull().default([]),
    evidenceSnapshot: jsonb("evidence_snapshot").$type<KnowledgeEvidenceSnapshot>().notNull(),
    engineVersion: text("engine_version").notNull(),
    status: text("status").notNull().default("active"),
    revertedByUserId: text("reverted_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("clinical_knowledge_applied_fact_run_phrase_unique").on(
      table.runId, table.category, table.normalizedPhrase,
    ),
    index("clinical_knowledge_applied_facts_org_child_idx").on(table.organizationId, table.childId, table.status),
  ],
);

/**
 * The source belongs to an organization, never a child. Child data is used
 * only transiently when requesting an insight and is not added to the corpus.
 */
export const clinicalKnowledgeSourcesTable = pgTable(
  "clinical_knowledge_sources",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    sourceType: text("source_type").notNull(),
    authorship: text("authorship"),
    citation: text("citation"),
    tags: jsonb("tags").$type<KnowledgeSourceTags>().notNull().default([]),
    status: text("status").notNull().default("processing"),
    activeVersionId: integer("active_version_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("clinical_knowledge_sources_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const clinicalKnowledgeSourceVersionsTable = pgTable(
  "clinical_knowledge_source_versions",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => clinicalKnowledgeSourcesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    storageDriver: text("storage_driver").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum").notNull(),
    extractorId: text("extractor_id").notNull(),
    extractionStatus: text("extraction_status").notNull().default("processing"),
    processingErrorCode: text("processing_error_code"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("clinical_knowledge_source_version_unique").on(
      table.sourceId,
      table.version,
    ),
    uniqueIndex("clinical_knowledge_source_storage_unique").on(
      table.storageDriver,
      table.storageKey,
    ),
  ],
);

export const clinicalKnowledgeIngestionJobsTable = pgTable(
  "clinical_knowledge_ingestion_jobs",
  {
    id: serial("id").primaryKey(),
    sourceVersionId: integer("source_version_id")
      .notNull()
      .references(() => clinicalKnowledgeSourceVersionsTable.id, {
        onDelete: "cascade",
      }),
    adapterId: text("adapter_id").notNull(),
    status: text("status").notNull().default("processing"),
    attempt: integer("attempt").notNull().default(1),
    failureCode: text("failure_code"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("clinical_knowledge_ingestion_status_idx").on(
      table.status,
      table.startedAt,
    ),
  ],
);

/**
 * Chunk text is encrypted by the server before persistence. Page/section
 * metadata stays queryable for citations without exposing source content.
 */
export const clinicalKnowledgeChunksTable = pgTable(
  "clinical_knowledge_chunks",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => clinicalKnowledgeSourcesTable.id, { onDelete: "cascade" }),
    sourceVersionId: integer("source_version_id")
      .notNull()
      .references(() => clinicalKnowledgeSourceVersionsTable.id, {
        onDelete: "cascade",
      }),
    ordinal: integer("ordinal").notNull(),
    page: integer("page"),
    section: text("section"),
    encryptedText: text("encrypted_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("clinical_knowledge_chunk_ordinal_unique").on(
      table.sourceVersionId,
      table.ordinal,
    ),
    index("clinical_knowledge_chunks_source_idx").on(
      table.sourceId,
      table.sourceVersionId,
    ),
  ],
);

export const clinicalKnowledgeInsightsTable = pgTable(
  "clinical_knowledge_insights",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sessionId: integer("session_id").references(() => therapySessionsTable.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    confidence: text("confidence").notNull(),
    disposition: text("disposition").notNull().default("draft"),
    reviewReason: text("review_reason"),
    alternatives: jsonb("alternatives").$type<InsightAlternatives>().notNull().default([]),
    evidenceFingerprint: text("evidence_fingerprint"),
    engineVersion: text("engine_version"),
    runId: integer("run_id").references(() => clinicalKnowledgeInsightRunsTable.id, { onDelete: "set null" }),
    encryptedSuggestion: text("encrypted_suggestion").notNull(),
    encryptedRationale: text("encrypted_rationale").notNull(),
    citations: jsonb("citations").$type<KnowledgeCitation[]>().notNull().default([]),
    evidenceSnapshot: jsonb("evidence_snapshot")
      .$type<KnowledgeEvidenceSnapshot>()
      .notNull(),
    provider: text("provider").notNull(),
    model: text("model"),
    status: text("status").notNull().default("draft"),
    encryptedClinicianEdit: text("encrypted_clinician_edit"),
    encryptedReviewNote: text("encrypted_review_note"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("clinical_knowledge_insight_run_category_unique").on(table.runId, table.category),
    index("clinical_knowledge_insights_org_child_idx").on(
      table.organizationId,
      table.childId,
      table.createdAt,
    ),
  ],
);

export const insertClinicalKnowledgeSourceSchema = createInsertSchema(
  clinicalKnowledgeSourcesTable,
).omit({ id: true, createdAt: true, updatedAt: true, archivedAt: true });
export const insertClinicalKnowledgeInsightSchema = createInsertSchema(
  clinicalKnowledgeInsightsTable,
).omit({ id: true, createdAt: true, updatedAt: true, reviewedAt: true });

export type ClinicalKnowledgeSource = typeof clinicalKnowledgeSourcesTable.$inferSelect;
export type ClinicalKnowledgeSourceVersion =
  typeof clinicalKnowledgeSourceVersionsTable.$inferSelect;
export type ClinicalKnowledgeChunk = typeof clinicalKnowledgeChunksTable.$inferSelect;
export type ClinicalKnowledgeInsight =
  typeof clinicalKnowledgeInsightsTable.$inferSelect;
export type ClinicalKnowledgeInsightRun =
  typeof clinicalKnowledgeInsightRunsTable.$inferSelect;
export type ClinicalKnowledgeAppliedFact =
  typeof clinicalKnowledgeAppliedFactsTable.$inferSelect;
export type InsertClinicalKnowledgeSource = z.infer<
  typeof insertClinicalKnowledgeSourceSchema
>;
export type InsertClinicalKnowledgeInsight = z.infer<
  typeof insertClinicalKnowledgeInsightSchema
>;