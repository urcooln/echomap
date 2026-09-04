import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childProfilesTable, organizationsTable, usersTable } from "./core-domain";
import { sessionTranscriptsTable, transcriptSpeakerSegmentsTable } from "./session-transcripts";

export const childPhraseInboxStatusValues = [
  "pending",
  "deferred",
  "dictionary_added",
  "excluded",
] as const;

/**
 * A durable review handoff between explicit Child-language attribution and
 * the canonical communication dictionary. Inbox rows are never evidence by
 * themselves; they retain provenance and clinician working context until a
 * reviewed session performs the dictionary transition.
 */
export const childPhraseInboxItemsTable = pgTable(
  "child_phrase_inbox_items",
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
    transcriptPhraseId: integer("transcript_phrase_id"),
    segmentId: integer("segment_id")
      .notNull()
      .references(() => transcriptSpeakerSegmentsTable.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    reviewDisposition: text("review_disposition").notNull().default("child"),
    status: text("status").notNull().default("pending"),
    workingMeaning: text("working_meaning"),
    reviewedByUserId: text("reviewed_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_phrase_inbox_transcript_segment_unique").on(table.transcriptId, table.segmentId),
    index("child_phrase_inbox_org_child_status_idx").on(table.organizationId, table.childId, table.status, table.updatedAt),
    index("child_phrase_inbox_transcript_idx").on(table.transcriptId),
  ],
);

export const insertChildPhraseInboxItemSchema = createInsertSchema(childPhraseInboxItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChildPhraseInboxItem = z.infer<typeof insertChildPhraseInboxItemSchema>;
export type ChildPhraseInboxItem = typeof childPhraseInboxItemsTable.$inferSelect;