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
import { z } from "zod/v4";
import { organizationsTable, usersTable } from "./core-domain";

export const slpProfilesTable = pgTable(
  "slp_profiles",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    professionalTitle: text("professional_title").notNull(),
    school: text("school").notNull(),
    schoolDistrict: text("school_district").notNull(),
    licensureState: text("licensure_state").notNull(),
    licenseNumber: text("license_number").notNull(),
    licenseExpirationDate: date("license_expiration_date"),
    ashaCccSlpNumber: text("asha_ccc_slp_number"),
    /** Self-reported until a future verification workflow changes this value. */
    licenseVerificationStatus: text("license_verification_status")
      .notNull()
      .default("unverified"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("slp_profiles_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("slp_profiles_user_idx").on(table.userId),
  ],
);

export const userAgreementAcceptancesTable = pgTable(
  "user_agreement_acceptances",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    clerkUserId: text("clerk_user_id").notNull(),
    agreementType: text("agreement_type").notNull(),
    documentVersion: text("document_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    school: text("school"),
  },
  (table) => [
    uniqueIndex("user_agreement_acceptances_org_user_type_version_unique").on(
      table.organizationId,
      table.userId,
      table.agreementType,
      table.documentVersion,
    ),
    index("user_agreement_acceptances_user_idx").on(table.userId),
  ],
);

export const insertSlpProfileSchema = createInsertSchema(slpProfilesTable).omit(
  { id: true, createdAt: true, updatedAt: true },
);
export const insertUserAgreementAcceptanceSchema = createInsertSchema(
  userAgreementAcceptancesTable,
).omit({ id: true, acceptedAt: true });

export type SlpProfile = typeof slpProfilesTable.$inferSelect;
export type InsertSlpProfile = z.infer<typeof insertSlpProfileSchema>;
export type UserAgreementAcceptance =
  typeof userAgreementAcceptancesTable.$inferSelect;
export type InsertUserAgreementAcceptance = z.infer<
  typeof insertUserAgreementAcceptanceSchema
>;
