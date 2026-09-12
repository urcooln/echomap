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
import {
  childProfilesTable,
  organizationsTable,
  therapySessionsTable,
  usersTable,
} from "./core-domain";
import { communicationGoalsTable } from "./communication-goals";

export const therapySessionGoalProgressTable = pgTable(
  "therapy_session_goal_progress",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => therapySessionsTable.id, { onDelete: "cascade" }),
    goalId: integer("goal_id")
      .notNull()
      .references(() => communicationGoalsTable.id, { onDelete: "restrict" }),
    goalVersion: integer("goal_version").notNull(),
    goalTitleSnapshot: text("goal_title_snapshot").notNull(),
    goalAreaSnapshot: text("goal_area_snapshot").notNull(),
    accuracyPercent: integer("accuracy_percent"),
    successfulAttempts: integer("successful_attempts"),
    totalAttempts: integer("total_attempts"),
    progressStatus: text("progress_status"),
    promptingLevel: text("prompting_level"),
    progressNote: text("progress_note").notNull().default(""),
    reviewedByUserId: text("reviewed_by_user_id").references(
      () => usersTable.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("therapy_session_goal_progress_session_goal_unique").on(
      table.sessionId,
      table.goalId,
    ),
    index("therapy_session_goal_progress_child_goal_idx").on(
      table.organizationId,
      table.childId,
      table.goalId,
    ),
  ],
);

export const insertTherapySessionGoalProgressSchema = createInsertSchema(
  therapySessionGoalProgressTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type TherapySessionGoalProgress =
  typeof therapySessionGoalProgressTable.$inferSelect;
