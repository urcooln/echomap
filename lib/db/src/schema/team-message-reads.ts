import { integer, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { teamMessagesTable } from "./team-messages";
import { usersTable } from "./core-domain";

export const teamMessageReadsTable = pgTable(
  "team_message_reads",
  {
    messageId: integer("message_id")
      .notNull()
      .references(() => teamMessagesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId] }),
    index("team_message_reads_user_idx").on(table.userId, table.readAt),
  ],
);

export type TeamMessageRead = typeof teamMessageReadsTable.$inferSelect;