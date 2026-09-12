import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  childProfilesTable,
  organizationsTable,
  usersTable,
} from "./core-domain";

export const teamConversationsTable = pgTable(
  "team_conversations",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    participantKey: text("participant_key").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("team_conversations_child_participants_unique").on(
      table.organizationId,
      table.childId,
      table.participantKey,
    ),
    index("team_conversations_org_child_updated_idx").on(
      table.organizationId,
      table.childId,
      table.updatedAt,
    ),
  ],
);

export const teamConversationParticipantsTable = pgTable(
  "team_conversation_participants",
  {
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => teamConversationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("team_conversation_participants_user_idx").on(
      table.userId,
      table.conversationId,
    ),
  ],
);

export type TeamConversation = typeof teamConversationsTable.$inferSelect;
export type TeamConversationParticipant =
  typeof teamConversationParticipantsTable.$inferSelect;
