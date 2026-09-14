DROP INDEX "beta_notice_acknowledgements_user_version_unique";--> statement-breakpoint
ALTER TABLE "beta_controls" ALTER COLUMN "current_notice_version" SET DEFAULT '1.0';--> statement-breakpoint
UPDATE "beta_controls"
SET "current_notice_version" = '1.0', "updated_at" = now()
WHERE "id" = 1;--> statement-breakpoint
INSERT INTO "beta_notices" ("version", "body")
VALUES (
  '1.0',
  E'By participating in the ChildLed beta, you understand that:\n- The software is under active development.\n- Features may change, be removed, or behave differently during testing.\n- You agree not to publicly share screenshots, screen recordings, unreleased features, confidential product information, or other non-public information about ChildLed.\n- You will not share your account credentials with unauthorized individuals.\n- Feedback you provide may be used by ChildLed to improve the product.\n- Beta access may be modified or revoked during the testing period.\n\nChildLed beta software is provided for testing and evaluation purposes and should not be relied upon as the sole source for clinical, educational, legal, or compliance decisions.'
)
ON CONFLICT ("version") DO UPDATE
SET "body" = excluded."body", "retired_at" = NULL;--> statement-breakpoint
ALTER TABLE "beta_notice_acknowledgements" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "beta_notice_acknowledgements" ADD COLUMN "clerk_user_id" text;--> statement-breakpoint
ALTER TABLE "beta_notice_acknowledgements" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "beta_notice_acknowledgements" ADD COLUMN "agreement_type" text DEFAULT 'beta_confidentiality' NOT NULL;--> statement-breakpoint
ALTER TABLE "beta_notice_acknowledgements" ADD COLUMN "login_session_hash" text;--> statement-breakpoint
ALTER TABLE "beta_notice_acknowledgements" ADD CONSTRAINT "beta_notice_acknowledgements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "beta_notice_acknowledgements_session_unique" ON "beta_notice_acknowledgements" USING btree ("user_id","agreement_type","notice_version","login_session_hash");--> statement-breakpoint
CREATE INDEX "beta_notice_acknowledgements_session_idx" ON "beta_notice_acknowledgements" USING btree ("login_session_hash");
