import {
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sessionAudioObjectsTable, usersTable } from "./core-domain";

export const slpRecordingUsageTable = pgTable(
  "slp_recording_usage",
  {
    id: serial("id").primaryKey(),
    audioId: text("audio_id")
      .notNull()
      .references(() => sessionAudioObjectsTable.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    durationMilliseconds: integer("duration_milliseconds").notNull(),
    status: text("status").notNull().default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("slp_recording_usage_audio_unique").on(table.audioId),
    index("slp_recording_usage_user_period_idx").on(
      table.userId,
      table.periodStart,
      table.status,
    ),
  ],
);
