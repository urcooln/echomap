CREATE TABLE "iep_service_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"service_name" text NOT NULL,
	"normalized_service_name" text NOT NULL,
	"required_sessions" integer NOT NULL,
	"required_minutes" integer NOT NULL,
	"session_duration_minutes" integer NOT NULL,
	"period" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapy_session_goal_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	"goal_version" integer NOT NULL,
	"goal_title_snapshot" text NOT NULL,
	"goal_area_snapshot" text NOT NULL,
	"accuracy_percent" integer,
	"successful_attempts" integer,
	"total_attempts" integer,
	"prompting_level" text,
	"progress_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "session_mode" text DEFAULT 'recorded' NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "session_date" date;--> statement-breakpoint
UPDATE "therapy_sessions" SET "session_date" = ("created_at" AT TIME ZONE 'UTC')::date WHERE "session_date" IS NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ALTER COLUMN "session_date" SET DEFAULT CURRENT_DATE;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ALTER COLUMN "session_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "duration_source" text DEFAULT 'recording' NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "duration_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "iep_service_requirements" ADD CONSTRAINT "iep_service_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_service_requirements" ADD CONSTRAINT "iep_service_requirements_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_service_requirements" ADD CONSTRAINT "iep_service_requirements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_service_requirements" ADD CONSTRAINT "iep_service_requirements_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_session_goal_progress" ADD CONSTRAINT "therapy_session_goal_progress_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_session_goal_progress" ADD CONSTRAINT "therapy_session_goal_progress_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_session_goal_progress" ADD CONSTRAINT "therapy_session_goal_progress_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_session_goal_progress" ADD CONSTRAINT "therapy_session_goal_progress_goal_id_communication_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."communication_goals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "iep_service_requirements_child_service_unique" ON "iep_service_requirements" USING btree ("organization_id","child_id","normalized_service_name");--> statement-breakpoint
CREATE INDEX "iep_service_requirements_child_status_idx" ON "iep_service_requirements" USING btree ("organization_id","child_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "therapy_session_goal_progress_session_goal_unique" ON "therapy_session_goal_progress" USING btree ("session_id","goal_id");--> statement-breakpoint
CREATE INDEX "therapy_session_goal_progress_child_goal_idx" ON "therapy_session_goal_progress" USING btree ("organization_id","child_id","goal_id");
