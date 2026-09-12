import {
  boolean,
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
  organizationsTable,
  usersTable,
} from "./core-domain";
import { teamConversationsTable } from "./team-conversations";

export const teamMessagesTable = pgTable(
  "team_messages",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    conversationId: integer("conversation_id").references(
      () => teamConversationsTable.id,
      { onDelete: "cascade" },
    ),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    recipientUserId: text("recipient_user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    senderRole: text("sender_role").notNull(),
    messageType: text("message_type").notNull().default("message"),
    audience: text("audience").notNull().default("entire_team"),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("team_messages_org_child_created_idx").on(
      table.organizationId,
      table.childId,
      table.createdAt,
    ),
    index("team_messages_sender_idx").on(table.senderUserId),
    index("team_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("team_messages_recipient_created_idx").on(
      table.recipientUserId,
      table.createdAt,
    ),
  ],
);

export const insertTeamMessageSchema = createInsertSchema(
  teamMessagesTable,
).omit({ id: true, createdAt: true });
export type InsertTeamMessage = z.infer<typeof insertTeamMessageSchema>;
export type TeamMessage = typeof teamMessagesTable.$inferSelect;
