CREATE TABLE "slp_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"professional_title" text NOT NULL,
	"school" text NOT NULL,
	"school_district" text NOT NULL,
	"licensure_state" text NOT NULL,
	"license_number" text NOT NULL,
	"license_expiration_date" date,
	"asha_ccc_slp_number" text,
	"license_verification_status" text DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_agreement_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"agreement_type" text NOT NULL,
	"document_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"school" text
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "account_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "onboarding_completed_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "slp_profiles" ADD CONSTRAINT "slp_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slp_profiles" ADD CONSTRAINT "slp_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agreement_acceptances" ADD CONSTRAINT "user_agreement_acceptances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agreement_acceptances" ADD CONSTRAINT "user_agreement_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slp_profiles_org_user_unique" ON "slp_profiles" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "slp_profiles_user_idx" ON "slp_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_agreement_acceptances_org_user_type_version_unique" ON "user_agreement_acceptances" USING btree ("organization_id","user_id","agreement_type","document_version");--> statement-breakpoint
CREATE INDEX "user_agreement_acceptances_user_idx" ON "user_agreement_acceptances" USING btree ("user_id");