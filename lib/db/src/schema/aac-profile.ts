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
import { childProfilesTable, organizationsTable, usersTable } from "./core-domain";

export const aacCommunicationModalityValues = [
  "aac",
  "spoken_language",
  "sign_language",
  "gestures",
  "written_language",
  "other",
] as const;
export type AacCommunicationModality = typeof aacCommunicationModalityValues[number];
export const aacUserStatusValues = ["yes", "no", "unknown"] as const;
export type AacUserStatus = typeof aacUserStatusValues[number];

export type AacProfileHistoryValue = {
  communicationModalities: AacCommunicationModality[];
  otherModalityLabel: string | null;
  aacUserStatus: AacUserStatus;
  deviceVendorId: string | null;
  deviceVendorCustomLabel: string | null;
  deviceModelId: string | null;
  deviceModelCustomLabel: string | null;
  vocabularySystemId: string | null;
  vocabularySystemCustomLabel: string | null;
  accessMethodId: string | null;
  accessMethodCustomLabel: string | null;
  ownershipId: string | null;
  ownershipCustomLabel: string | null;
  notes: string | null;
};

export const aacProfilesTable = pgTable(
  "aac_profiles",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    communicationModalities: jsonb("communication_modalities")
      .$type<AacCommunicationModality[]>()
      .notNull()
      .default([]),
    otherModalityLabel: text("other_modality_label"),
    aacUserStatus: text("aac_user_status").notNull().default("unknown"),
    deviceVendorId: text("device_vendor_id"),
    deviceVendorCustomLabel: text("device_vendor_custom_label"),
    deviceModelId: text("device_model_id"),
    deviceModelCustomLabel: text("device_model_custom_label"),
    vocabularySystemId: text("vocabulary_system_id"),
    vocabularySystemCustomLabel: text("vocabulary_system_custom_label"),
    accessMethodId: text("access_method_id"),
    accessMethodCustomLabel: text("access_method_custom_label"),
    ownershipId: text("ownership_id"),
    ownershipCustomLabel: text("ownership_custom_label"),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByUserId: text("confirmed_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    confirmedByName: text("confirmed_by_name"),
    confirmedByRole: text("confirmed_by_role"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    updatedByUserId: text("updated_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    updatedByName: text("updated_by_name"),
    updatedByRole: text("updated_by_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("aac_profiles_org_child_unique").on(table.organizationId, table.childId),
    index("aac_profiles_child_idx").on(table.childId),
  ],
);

export const aacProfileHistoryTable = pgTable(
  "aac_profile_history",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    profileId: integer("profile_id").references(() => aacProfilesTable.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    previousModalities: jsonb("previous_modalities").$type<AacCommunicationModality[] | null>(),
    nextModalities: jsonb("next_modalities").$type<AacCommunicationModality[] | null>(),
    previousOtherModalityLabel: text("previous_other_modality_label"),
    nextOtherModalityLabel: text("next_other_modality_label"),
    changedFields: jsonb("changed_fields").$type<string[]>().notNull().default([]),
    previousValue: jsonb("previous_value").$type<AacProfileHistoryValue | null>(),
    nextValue: jsonb("next_value").$type<AacProfileHistoryValue | null>(),
    actorUserId: text("actor_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("aac_profile_history_org_child_idx").on(table.organizationId, table.childId, table.occurredAt),
  ],
);

export const insertAacProfileSchema = createInsertSchema(aacProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAacProfile = z.infer<typeof insertAacProfileSchema>;
export type AacProfile = typeof aacProfilesTable.$inferSelect;
export type AacProfileHistory = typeof aacProfileHistoryTable.$inferSelect;