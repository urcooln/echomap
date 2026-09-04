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
  organizationsTable,
  therapySessionsTable,
  usersTable,
} from "./core-domain";

export type ClinicalSoapNoteContent = {
  subjective: string;
  objective: string;
  assessment: string;
  nlaObservations: string;
  gestaltTracking: string;
  plan: string;
  caregiverSummary: string;
};
export type ClinicalSoapCitation = {
  sourceId: number;
  sourceVersionId: number;
  chunkId: number;
  sourceTitle: string;
  page: number | null;
  section: string | null;
};

/**
 * Clinician-owned edits to a generated SOAP draft. The underlying reviewed
 * session and dictionary evidence remain separate and are always reloaded by
 * the report API rather than copied into this record.
 */
export const clinicalSoapNotesTable = pgTable(
  "clinical_soap_notes",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => therapySessionsTable.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<ClinicalSoapNoteContent>().notNull(),
    /**
     * Drafts created before a stricter evidence policy are regenerated rather
     * than replayed. Clinician saves under the current policy use version 2.
     */
    evidenceVersion: integer("evidence_version").notNull().default(1),
    clinicianEdited: boolean("clinician_edited").notNull().default(false),
    status: text("status").notNull().default("draft"),
    evidenceFingerprint: text("evidence_fingerprint"),
    engineVersion: text("engine_version"),
    citations: jsonb("citations").$type<ClinicalSoapCitation[]>().notNull().default([]),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
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
    uniqueIndex("clinical_soap_notes_session_unique").on(table.sessionId),
    index("clinical_soap_notes_org_child_idx").on(table.organizationId, table.childId),
    index("clinical_soap_notes_lifecycle_idx").on(table.organizationId, table.status, table.purgeAfter),
  ],
);

export const insertClinicalSoapNoteSchema = createInsertSchema(clinicalSoapNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClinicalSoapNote = z.infer<typeof insertClinicalSoapNoteSchema>;
export type ClinicalSoapNote = typeof clinicalSoapNotesTable.$inferSelect;