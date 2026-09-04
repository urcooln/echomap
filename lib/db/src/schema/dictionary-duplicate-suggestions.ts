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
import { childProfilesTable, clinicalGestaltsTable, organizationsTable, usersTable } from "./core-domain";

export const duplicateSuggestionDecisionValues = ["merged", "keep_separate", "dismissed"] as const;

export const dictionaryDuplicateSuggestionsTable = pgTable(
  "dictionary_duplicate_suggestions",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    firstGestaltId: integer("first_gestalt_id")
      .notNull()
      .references(() => clinicalGestaltsTable.id, { onDelete: "restrict" }),
    secondGestaltId: integer("second_gestalt_id")
      .notNull()
      .references(() => clinicalGestaltsTable.id, { onDelete: "restrict" }),
    evidenceFingerprint: text("evidence_fingerprint").notNull(),
    decision: text("decision"),
    decisionUserId: text("decision_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    decisionActorName: text("decision_actor_name"),
    decisionActorRole: text("decision_actor_role"),
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("dictionary_duplicate_suggestions_pair_unique").on(
      table.organizationId,
      table.childId,
      table.firstGestaltId,
      table.secondGestaltId,
    ),
    index("dictionary_duplicate_suggestions_org_child_idx").on(table.organizationId, table.childId, table.decision),
  ],
);

export const insertDictionaryDuplicateSuggestionSchema = createInsertSchema(dictionaryDuplicateSuggestionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DuplicateSuggestionDecision = (typeof duplicateSuggestionDecisionValues)[number];
export type DictionaryDuplicateSuggestion = typeof dictionaryDuplicateSuggestionsTable.$inferSelect;
export type InsertDictionaryDuplicateSuggestion = z.infer<typeof insertDictionaryDuplicateSuggestionSchema>;