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
import {
  childProfilesTable,
  organizationsTable,
  usersTable,
} from "./core-domain";

export type CommunicationPassportPhrase = {
  phrase: string;
  meaning: string;
};

export type CommunicationPassportContent = {
  childName: string;
  preferredName: string;
  aboutMe: string;
  communicationMethods: string[];
  communicationStrengths: string[];
  wantsAndNeeds: string;
  commonPhrases: CommunicationPassportPhrase[];
  gestures: string[];
  aacInformation: string;
  helpfulStrategies: string[];
  communicationChallenges: string[];
  frustrationSupports: string[];
  importantWords: CommunicationPassportPhrase[];
  interests: string[];
  currentGoals: string[];
  additionalInformation: string;
};

export const communicationPassportsTable = pgTable(
  "communication_passports",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull().default("general"),
    languageTag: text("language_tag").notNull().default("en"),
    content: jsonb("content").$type<CommunicationPassportContent>().notNull(),
    version: integer("version").notNull().default(1),
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
    uniqueIndex("communication_passports_org_child_unique").on(
      table.organizationId,
      table.childId,
    ),
    index("communication_passports_child_updated_idx").on(
      table.childId,
      table.updatedAt,
    ),
  ],
);

export const insertCommunicationPassportSchema = createInsertSchema(
  communicationPassportsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommunicationPassport = z.infer<
  typeof insertCommunicationPassportSchema
>;
export type CommunicationPassport =
  typeof communicationPassportsTable.$inferSelect;
