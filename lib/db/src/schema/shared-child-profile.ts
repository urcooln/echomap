import {
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

export const sharedChildProfileSectionValues = [
  "strengths",
  "interests",
  "sensory_supports",
  "regulation_notes",
] as const;
export type SharedChildProfileSection = typeof sharedChildProfileSectionValues[number];

export const sharedChildProfileEntriesTable = pgTable(
  "shared_child_profile_entries",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    section: text("section").notNull(),
    category: text("category").notNull().default(""),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    authorUserId: text("author_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("shared_child_profile_entries_org_child_idx").on(table.organizationId, table.childId, table.section, table.deletedAt),
    uniqueIndex("shared_child_profile_entries_active_value_unique")
      .on(table.organizationId, table.childId, table.section, table.category, table.normalizedValue)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const sharedChildProfileHistoryTable = pgTable(
  "shared_child_profile_history",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    entryId: integer("entry_id"),
    section: text("section").notNull(),
    action: text("action").notNull(),
    previousValue: text("previous_value"),
    nextValue: text("next_value"),
    actorUserId: text("actor_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
  },
  (table) => [
    index("shared_child_profile_history_org_child_idx").on(table.organizationId, table.childId, table.occurredAt),
  ],
);

export const insertSharedChildProfileEntrySchema = createInsertSchema(sharedChildProfileEntriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSharedChildProfileEntry = z.infer<typeof insertSharedChildProfileEntrySchema>;
export type SharedChildProfileEntry = typeof sharedChildProfileEntriesTable.$inferSelect;
export type SharedChildProfileHistory = typeof sharedChildProfileHistoryTable.$inferSelect;