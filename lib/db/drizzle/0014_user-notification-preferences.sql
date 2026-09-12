CREATE TABLE "user_notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"messages" boolean DEFAULT true NOT NULL,
	"student_updates" boolean DEFAULT true NOT NULL,
	"communication_activity" boolean DEFAULT true NOT NULL,
	"weekly_summary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_preferences_org_user_unique" ON "user_notification_preferences" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "user_notification_preferences_user_idx" ON "user_notification_preferences" USING btree ("user_id");