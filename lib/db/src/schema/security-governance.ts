import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./core-domain";

/**
 * Append-only security events. Metadata is deliberately limited to safe,
 * non-content details (never notes, transcripts, audio, passwords, or tokens).
 */
export const securityAuditLogsTable = pgTable(
  "security_audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    childId: integer("child_id"),
    outcome: text("outcome").notNull().default("success"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_audit_logs_occurred_at_idx").on(table.occurredAt),
    index("security_audit_logs_user_id_idx").on(table.userId),
    index("security_audit_logs_child_id_idx").on(table.childId),
    index("security_audit_logs_action_idx").on(table.action),
  ],
);

export const sensitiveDataClassificationsTable = pgTable(
  "sensitive_data_classifications",
  {
    id: serial("id").primaryKey(),
    dataType: text("data_type").notNull(),
    category: text("category").notNull(),
    sensitivity: text("sensitivity").notNull().default("sensitive"),
    accessPolicy: text("access_policy").notNull().default("private-child-care-team"),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sensitive_data_classifications_type_unique").on(table.dataType)],
);

export const retentionSettingsTable = pgTable(
  "retention_settings",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default("organization"),
    audioRetentionDays: integer("audio_retention_days").notNull().default(365),
    observationVideoRetentionDays: integer("observation_video_retention_days").notNull().default(365),
    sessionNoteRetentionDays: integer("session_note_retention_days").notNull().default(2555),
    archivedClientStorageDays: integer("archived_client_storage_days").notNull().default(365),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("retention_settings_org_scope_unique").on(table.organizationId, table.scope)],
);

/**
 * Non-operative request records reserved for future parent access, export, and
 * deletion flows. No endpoint in this task accepts or processes requests.
 */
export const dataSubjectRequestPlaceholdersTable = pgTable(
  "data_subject_request_placeholders",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id").notNull(),
    requesterUserId: text("requester_user_id").notNull(),
    requestType: text("request_type").notNull(),
    status: text("status").notNull().default("placeholder"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("data_subject_request_placeholders_child_id_idx").on(table.childId),
    index("data_subject_request_placeholders_requester_id_idx").on(table.requesterUserId),
  ],
);

export const insertSecurityAuditLogSchema = createInsertSchema(securityAuditLogsTable).omit({
  id: true,
  occurredAt: true,
});
export const insertRetentionSettingsSchema = createInsertSchema(retentionSettingsTable).omit({
  id: true,
  updatedAt: true,
});

export type SecurityAuditLog = typeof securityAuditLogsTable.$inferSelect;
export type RetentionSettings = typeof retentionSettingsTable.$inferSelect;
export type SensitiveDataClassification = typeof sensitiveDataClassificationsTable.$inferSelect;
export type DataSubjectRequestPlaceholder = typeof dataSubjectRequestPlaceholdersTable.$inferSelect;
export type InsertSecurityAuditLog = z.infer<typeof insertSecurityAuditLogSchema>;