import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childProfilesTable, organizationsTable, usersTable } from "./core-domain";

export type ParentLearningSection = {
  heading: string;
  body?: string;
  bullets?: string[];
  callout?: string;
};

export const parentLearningResourcesTable = pgTable(
  "parent_learning_resources",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
    resourceKey: text("resource_key").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    contentVersion: text("content_version").notNull(),
    pdfObjectPath: text("pdf_object_path"),
    pdfContentType: text("pdf_content_type"),
    pdfSizeBytes: integer("pdf_size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("parent_learning_resources_org_key_unique").on(table.organizationId, table.resourceKey),
    index("parent_learning_resources_org_idx").on(table.organizationId),
  ],
);

export const parentLearningModulesTable = pgTable(
  "parent_learning_modules",
  {
    id: serial("id").primaryKey(),
    resourceId: integer("resource_id").notNull().references(() => parentLearningResourcesTable.id, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    readingMinutes: integer("reading_minutes").notNull(),
    sections: jsonb("sections").$type<ParentLearningSection[]>().notNull().default([]),
    tryThisAtHome: jsonb("try_this_at_home").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("parent_learning_modules_resource_key_unique").on(table.resourceId, table.moduleKey),
    index("parent_learning_modules_resource_position_idx").on(table.resourceId, table.position),
  ],
);

export const parentLearningProgressTable = pgTable(
  "parent_learning_progress",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id").notNull().references(() => childProfilesTable.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    resourceId: integer("resource_id").notNull().references(() => parentLearningResourcesTable.id, { onDelete: "cascade" }),
    moduleId: integer("module_id").notNull().references(() => parentLearningModulesTable.id, { onDelete: "cascade" }),
    bookmarked: boolean("bookmarked").notNull().default(false),
    completed: boolean("completed").notNull().default(false),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("parent_learning_progress_user_child_module_unique").on(table.userId, table.childId, table.moduleId),
    index("parent_learning_progress_scope_idx").on(table.organizationId, table.childId, table.userId),
    index("parent_learning_progress_last_viewed_idx").on(table.userId, table.childId, table.lastViewedAt),
  ],
);

export const parentLearningReflectionsTable = pgTable(
  "parent_learning_reflections",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id").notNull().references(() => childProfilesTable.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    resourceId: integer("resource_id").notNull().references(() => parentLearningResourcesTable.id, { onDelete: "cascade" }),
    moduleId: integer("module_id").notNull().references(() => parentLearningModulesTable.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("parent_learning_reflections_user_child_module_unique").on(table.userId, table.childId, table.moduleId),
    index("parent_learning_reflections_scope_idx").on(table.organizationId, table.childId, table.userId),
  ],
);

export const insertParentLearningResourceSchema = createInsertSchema(parentLearningResourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParentLearningModuleSchema = createInsertSchema(parentLearningModulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParentLearningProgressSchema = createInsertSchema(parentLearningProgressTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParentLearningReflectionSchema = createInsertSchema(parentLearningReflectionsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ParentLearningResource = typeof parentLearningResourcesTable.$inferSelect;
export type ParentLearningModule = typeof parentLearningModulesTable.$inferSelect;
export type ParentLearningProgress = typeof parentLearningProgressTable.$inferSelect;
export type ParentLearningReflection = typeof parentLearningReflectionsTable.$inferSelect;
export type InsertParentLearningResource = z.infer<typeof insertParentLearningResourceSchema>;
export type InsertParentLearningModule = z.infer<typeof insertParentLearningModuleSchema>;
export type InsertParentLearningProgress = z.infer<typeof insertParentLearningProgressSchema>;
export type InsertParentLearningReflection = z.infer<typeof insertParentLearningReflectionSchema>;