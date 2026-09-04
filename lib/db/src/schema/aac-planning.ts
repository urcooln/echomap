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

export const aacPlanningDecisionValues = [
  "candidate",
  "review_later",
  "added_to_device",
  "not_appropriate",
] as const;

export const aacVocabularyPlanningTable = pgTable(
  "aac_vocabulary_planning",
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
    status: text("status").notNull().default("candidate"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("aac_vocabulary_planning_child_gestalt_unique").on(table.childId, table.gestaltId),
    index("aac_vocabulary_planning_org_child_status_idx").on(table.organizationId, table.childId, table.status),
  ],
);

export const aacVocabularyPlanningMergeHistoryTable = pgTable(
  "aac_vocabulary_planning_merge_history",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sourceGestaltId: integer("source_gestalt_id")
      .notNull()
      .references(() => clinicalGestaltsTable.id, { onDelete: "restrict" }),
    canonicalGestaltId: integer("canonical_gestalt_id")
      .notNull()
      .references(() => clinicalGestaltsTable.id, { onDelete: "restrict" }),
    sourceStatus: text("source_status").notNull(),
    sourceCreatedByUserId: text("source_created_by_user_id").notNull(),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }).notNull(),
    canonicalStatus: text("canonical_status").notNull(),
    canonicalCreatedByUserId: text("canonical_created_by_user_id").notNull(),
    canonicalCreatedAt: timestamp("canonical_created_at", { withTimezone: true }).notNull(),
    mergedByUserId: text("merged_by_user_id").notNull(),
    mergedAt: timestamp("merged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("aac_vocabulary_planning_merge_history_child_idx").on(table.organizationId, table.childId, table.mergedAt),
  ],
);

export const insertAacVocabularyPlanningSchema = createInsertSchema(aacVocabularyPlanningTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AacPlanningDecision = (typeof aacPlanningDecisionValues)[number];
export type AacVocabularyPlanning = typeof aacVocabularyPlanningTable.$inferSelect;
export type InsertAacVocabularyPlanning = z.infer<typeof insertAacVocabularyPlanningSchema>;