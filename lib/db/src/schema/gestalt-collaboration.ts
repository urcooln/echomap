import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  childProfilesTable,
  clinicalGestaltsTable,
  organizationsTable,
  usersTable,
} from "./core-domain";

/**
 * Care-team interpretation stays separate from the clinician-owned dictionary
 * entry. This lets a parent or teacher add context without silently changing a
 * reviewed clinical meaning.
 */
export const gestaltCollaborationNotesTable = pgTable(
  "gestalt_collaboration_notes",
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
      .references(() => clinicalGestaltsTable.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("gestalt_collaboration_notes_org_child_idx").on(
      table.organizationId,
      table.childId,
      table.createdAt,
    ),
    index("gestalt_collaboration_notes_gestalt_idx").on(table.gestaltId),
  ],
);

export const insertGestaltCollaborationNoteSchema = createInsertSchema(
  gestaltCollaborationNotesTable,
).omit({ id: true, createdAt: true });

export type InsertGestaltCollaborationNote = z.infer<
  typeof insertGestaltCollaborationNoteSchema
>;
export type GestaltCollaborationNote =
  typeof gestaltCollaborationNotesTable.$inferSelect;