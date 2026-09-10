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
    promptingLevel: text("prompting_level"),
    progressNote: text("progress_note").notNull().default(""),
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

export const iepServiceRequirementsTable = pgTable(
  "iep_service_requirements",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    serviceName: text("service_name").notNull(),
    normalizedServiceName: text("normalized_service_name").notNull(),
    requiredSessions: integer("required_sessions").notNull(),
    requiredMinutes: integer("required_minutes").notNull(),
    sessionDurationMinutes: integer("session_duration_minutes").notNull(),
    period: text("period").notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
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
    uniqueIndex("iep_service_requirements_child_service_unique").on(
      table.organizationId,
      table.childId,
      table.normalizedServiceName,
    ),
    index("iep_service_requirements_child_status_idx").on(
      table.organizationId,
      table.childId,
      table.status,
    ),
  ],
);

export const insertTherapySessionGoalProgressSchema = createInsertSchema(
  therapySessionGoalProgressTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertIepServiceRequirementSchema = createInsertSchema(
  iepServiceRequirementsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type TherapySessionGoalProgress =
  typeof therapySessionGoalProgressTable.$inferSelect;
export type IepServiceRequirement =
  typeof iepServiceRequirementsTable.$inferSelect;
