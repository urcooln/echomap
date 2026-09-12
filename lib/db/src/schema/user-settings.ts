import {
  boolean,
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
import { organizationsTable, usersTable } from "./core-domain";

export const userNotificationPreferencesTable = pgTable(
  "user_notification_preferences",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    messages: boolean("messages").notNull().default(true),
    studentUpdates: boolean("student_updates").notNull().default(true),
    communicationActivity: boolean("communication_activity")
      .notNull()
      .default(true),
    weeklySummary: boolean("weekly_summary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_notification_preferences_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("user_notification_preferences_user_idx").on(table.userId),
  ],
);

export const insertUserNotificationPreferenceSchema = createInsertSchema(
  userNotificationPreferencesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type UserNotificationPreference =
  typeof userNotificationPreferencesTable.$inferSelect;
export type InsertUserNotificationPreference = z.infer<
  typeof insertUserNotificationPreferenceSchema
>;
