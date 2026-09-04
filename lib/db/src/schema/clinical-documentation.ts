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
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  childProfilesTable,
  organizationsTable,
  therapySessionsTable,
  usersTable,
} from "./core-domain";

export const clinicalDocumentationFormatValues = [
  "session_note",
  "soap_note",
  "progress_note",
  "parent_summary",
  "teacher_summary",
] as const;
export const clinicalDocumentationStatusValues = [
  "draft",
  "finalized",
  "archived",
  "recently_deleted",
] as const;

export type ClinicalDocumentationContent = {
  sessionSummary: string;
  observedGestalts: string;
  communicationFunctions: string;
  nlaObservations: string;
  potentialGestalts: string;
  suggestedClinicalImpressions: string;
  clinicianNotes: string;
  observedLanguage: string;
  communicationFunctionsObserved: string;
  notableLanguageChanges: string;
  nlaGestaltInsights: string;
  sessionParticipation: string;
  aacPlanningOpportunities: string;
  suggestedDictionaryCandidates: string;
  suggestedFollowUpTargets: string;
  communicationGrowthSnapshot: string;
  familyTeamHighlights: string;
  evidenceReferences: ClinicalDocumentationEvidenceReference[];
  goalConnections?: GoalConnection[];
};
export type GoalConnection = {
  goalId: number;
  goalTitle: string;
  goalArea: string;
  goalVersion: number;
  sourceKind: string;
  sourceId: number;
  sourceLabel: string;
  sourceDetail: string;
  evidenceClass: "reviewed_clinical_evidence" | "care_team_context";
  included: boolean;
};

export type ClinicalDocumentationEvidenceReference = {
  id: string;
  kind: "reviewed_utterance" | "prior_reviewed_session" | "dictionary_history";
  label: string;
  detail: string;
};

/**
 * A clinician-owned working or finalized document. Generated content is
 * deliberately stored separately from the reviewed session evidence so edits
 * never change the underlying clinical record.
 */
export const clinicalDocumentationTable = pgTable(
  "clinical_documentation",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sourceSessionId: integer("source_session_id")
      .references(() => therapySessionsTable.id, { onDelete: "set null" }),
    format: text("format").notNull(),
    status: text("status").notNull().default("draft"),
    title: text("title").notNull(),
    inputObservations: text("input_observations").notNull().default(""),
    inputSummary: text("input_summary").notNull().default(""),
    inputQuickNote: text("input_quick_note").notNull().default(""),
    content: jsonb("content").$type<ClinicalDocumentationContent>().notNull(),
    generated: boolean("generated").notNull().default(true),
    generationSource: text("generation_source").notNull().default("clinician_input"),
    evidenceVersion: integer("evidence_version").notNull().default(1),
    evidenceFingerprint: text("evidence_fingerprint"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: text("approved_by_user_id")
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: text("archived_by_user_id")
      .references(() => usersTable.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: text("deleted_by_user_id")
      .references(() => usersTable.id, { onDelete: "restrict" }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
  },
  (table) => [
    index("clinical_documentation_org_child_updated_idx").on(table.organizationId, table.childId, table.updatedAt),
    index("clinical_documentation_source_session_idx").on(table.sourceSessionId),
    index("clinical_documentation_lifecycle_idx").on(table.organizationId, table.status, table.purgeAfter),
    uniqueIndex("clinical_documentation_active_ai_summary_unique")
      .on(table.organizationId, table.childId, table.sourceSessionId, table.generationSource)
      .where(sql`${table.status} = 'draft' and ${table.generationSource} = 'ai_confirmed_child_language_v2'`),
  ],
);

export const insertClinicalDocumentationSchema = createInsertSchema(clinicalDocumentationTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClinicalDocumentation = z.infer<typeof insertClinicalDocumentationSchema>;
export type ClinicalDocumentation = typeof clinicalDocumentationTable.$inferSelect;