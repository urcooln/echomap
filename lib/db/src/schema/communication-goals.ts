import { date, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childProfilesTable, organizationsTable, usersTable } from "./core-domain";

export const communicationGoalStatusValues = ["active", "archived"] as const;
export type CommunicationGoalStatus = typeof communicationGoalStatusValues[number];

export const communicationGoalsTable = pgTable("communication_goals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
  childId: integer("child_id").notNull().references(() => childProfilesTable.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  goalArea: text("goal_area").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("active"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  targetDate: date("target_date", { mode: "string" }),
  version: integer("version").notNull().default(1),
  createdByUserId: text("created_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  updatedByUserId: text("updated_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedByUserId: text("archived_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("communication_goals_org_child_status_idx").on(table.organizationId, table.childId, table.status)]);

export const communicationGoalHistoryTable = pgTable("communication_goal_history", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
  childId: integer("child_id").notNull().references(() => childProfilesTable.id, { onDelete: "restrict" }),
  goalId: integer("goal_id").notNull().references(() => communicationGoalsTable.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  version: integer("version").notNull(),
  actorUserId: text("actor_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [index("communication_goal_history_goal_idx").on(table.goalId, table.occurredAt)]);

export const insertCommunicationGoalSchema = createInsertSchema(communicationGoalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CommunicationGoal = typeof communicationGoalsTable.$inferSelect;