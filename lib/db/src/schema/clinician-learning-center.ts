import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizationsTable, usersTable } from "./core-domain";

export type ClinicianLearningSection = {
  sectionKey?: string;
  heading: string;
  body?: string;
  bullets?: string[];
  callout?: string;
  clinicalNote?: string;
  checklist?: string[];
  links?: Array<{ label: string; url: string; kind?: "article" | "video" | "handout" }>;
  example?: {
    transcript?: string;
    childLanguageDecision?: string;
    workingMeaning?: string;
    communicationFunction?: string;
    dictionaryEntry?: string;
    aacPlanningDecision?: string;
    sessionSummary?: string;
  };
};

export const clinicianLearningResourcesTable = pgTable("clinician_learning_resources", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
  resourceKey: text("resource_key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  contentVersion: text("content_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("clinician_learning_resources_org_key_unique").on(table.organizationId, table.resourceKey),
  index("clinician_learning_resources_org_idx").on(table.organizationId),
]);

export const clinicianLearningModulesTable = pgTable("clinician_learning_modules", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull().references(() => clinicianLearningResourcesTable.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  category: text("category").notNull(),
  kind: text("kind").notNull().default("guide"),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  readingMinutes: integer("reading_minutes").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  workflowContexts: jsonb("workflow_contexts").$type<string[]>().notNull().default([]),
  sections: jsonb("sections").$type<ClinicianLearningSection[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("clinician_learning_modules_resource_key_unique").on(table.resourceId, table.moduleKey),
  index("clinician_learning_modules_category_idx").on(table.resourceId, table.category, table.position),
]);

export const clinicianLearningProgressTable = pgTable("clinician_learning_progress", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  resourceId: integer("resource_id").notNull().references(() => clinicianLearningResourcesTable.id, { onDelete: "cascade" }),
  moduleId: integer("module_id").notNull().references(() => clinicianLearningModulesTable.id, { onDelete: "cascade" }),
  bookmarked: boolean("bookmarked").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  lastSectionKey: text("last_section_key"),
  progressPercent: integer("progress_percent").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("clinician_learning_progress_org_user_module_unique").on(table.organizationId, table.userId, table.moduleId),
  index("clinician_learning_progress_scope_idx").on(table.organizationId, table.userId),
]);

export const clinicianLearningPreferencesTable = pgTable("clinician_learning_preferences", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  workflowCoachingEnabled: boolean("workflow_coaching_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("clinician_learning_preferences_org_user_unique").on(table.organizationId, table.userId),
  index("clinician_learning_preferences_org_idx").on(table.organizationId),
]);