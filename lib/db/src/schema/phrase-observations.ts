import {
  index,
  integer,
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
  clinicalGestaltsTable,
  organizationsTable,
  usersTable,
} from "./core-domain";
import { gestaltCollaborationNotesTable } from "./gestalt-collaboration";

/**
 * Immutable, typed care-team evidence for one observed phrase. Collaboration
 * notes remain human discussion and must never be interpreted as evidence.
 */
export const phraseObservationsTable = pgTable(
  "phrase_observations",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    gestaltId: integer("gestalt_id")
      .notNull()
      .references(() => clinicalGestaltsTable.id, { onDelete: "restrict" }),
    sourceNoteId: integer("source_note_id")
      .references(() => gestaltCollaborationNotesTable.id, { onDelete: "restrict" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    context: text("context").notNull(),
    communicationFunction: text("communication_function"),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("phrase_observations_org_child_observed_idx").on(
      table.organizationId,
      table.childId,
      table.observedAt,
    ),
    index("phrase_observations_gestalt_idx").on(table.gestaltId),
    uniqueIndex("phrase_observations_source_note_unique")
      .on(table.sourceNoteId)
      .where(sql`${table.sourceNoteId} IS NOT NULL`),
  ],
);

export const insertPhraseObservationSchema = createInsertSchema(phraseObservationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPhraseObservation = z.infer<typeof insertPhraseObservationSchema>;
export type PhraseObservation = typeof phraseObservationsTable.$inferSelect;

/**
 * Append-only clinician decision proving that one historical collaboration
 * note was deliberately converted into typed phrase evidence.
 */
export const legacyPhraseObservationRecoveriesTable = pgTable(
  "legacy_phrase_observation_recoveries",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sourceNoteId: integer("source_note_id")
      .notNull()
      .references(() => gestaltCollaborationNotesTable.id, { onDelete: "restrict" }),
    sourceGestaltId: integer("source_gestalt_id")
      .notNull()
      .references(() => clinicalGestaltsTable.id, { onDelete: "restrict" }),
    targetGestaltId: integer("target_gestalt_id")
      .notNull()
      .references(() => clinicalGestaltsTable.id, { onDelete: "restrict" }),
    phraseObservationId: integer("phrase_observation_id")
      .notNull()
      .references(() => phraseObservationsTable.id, { onDelete: "restrict" }),
    reviewedByUserId: text("reviewed_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    reviewedByName: text("reviewed_by_name").notNull(),
    meaning: text("meaning").notNull(),
    communicationFunction: text("communication_function").notNull(),
    context: text("context").notNull(),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legacy_phrase_observation_recoveries_note_unique").on(table.sourceNoteId),
    uniqueIndex("legacy_phrase_observation_recoveries_observation_unique").on(table.phraseObservationId),
    index("legacy_phrase_observation_recoveries_org_child_idx").on(
      table.organizationId,
      table.childId,
      table.recoveredAt,
    ),
  ],
);

export const insertLegacyPhraseObservationRecoverySchema = createInsertSchema(
  legacyPhraseObservationRecoveriesTable,
).omit({ id: true, recoveredAt: true });
export type InsertLegacyPhraseObservationRecovery = z.infer<
  typeof insertLegacyPhraseObservationRecoverySchema
>;
export type LegacyPhraseObservationRecovery =
  typeof legacyPhraseObservationRecoveriesTable.$inferSelect;