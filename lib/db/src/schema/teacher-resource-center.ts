import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { childProfilesTable, organizationsTable, usersTable } from "./core-domain";

export type TeacherResourceSection = { heading: string; body?: string; bullets?: string[]; callout?: string };

export const teacherResourcesTable = pgTable("teacher_resources", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
  resourceKey: text("resource_key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  contentVersion: text("content_version").notNull(),
  pdfObjectPath: text("pdf_object_path"),
  pdfContentType: text("pdf_content_type"),
  pdfSizeBytes: integer("pdf_size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("teacher_resources_org_key_unique").on(table.organizationId, table.resourceKey),
  index("teacher_resources_org_idx").on(table.organizationId),
]);

export const teacherResourceItemsTable = pgTable("teacher_resource_items", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull().references(() => teacherResourcesTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  resourceKey: text("resource_key").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  readingMinutes: integer("reading_minutes").notNull(),
  sections: jsonb("sections").$type<TeacherResourceSection[]>().notNull().default([]),
  format: text("format").notNull().default("guide"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("teacher_resource_items_resource_key_unique").on(table.resourceId, table.resourceKey),
  index("teacher_resource_items_category_idx").on(table.resourceId, table.category, table.position),
]);

export const teacherResourceProgressTable = pgTable("teacher_resource_progress", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
  childId: integer("child_id").notNull().references(() => childProfilesTable.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  resourceId: integer("resource_id").notNull().references(() => teacherResourcesTable.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => teacherResourceItemsTable.id, { onDelete: "cascade" }),
  bookmarked: boolean("bookmarked").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("teacher_resource_progress_user_child_item_unique").on(table.userId, table.childId, table.itemId),
  index("teacher_resource_progress_scope_idx").on(table.organizationId, table.childId, table.userId),
]);