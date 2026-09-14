CREATE TABLE "student_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"from_slp_user_id" text NOT NULL,
	"to_slp_user_id" text,
	"destination_email" text NOT NULL,
	"transfer_mode" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invitation_id" integer,
	"initiated_by_user_id" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_transfers_mode_check" CHECK ("student_transfers"."transfer_mode" in ('existing_account', 'invitation')),
	CONSTRAINT "student_transfers_status_check" CHECK ("student_transfers"."status" in ('pending', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_from_slp_user_id_users_id_fk" FOREIGN KEY ("from_slp_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_to_slp_user_id_users_id_fk" FOREIGN KEY ("to_slp_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_invitation_id_care_team_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."care_team_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transfers" ADD CONSTRAINT "student_transfers_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_transfers_one_pending_child_unique" ON "student_transfers" USING btree ("child_id") WHERE "student_transfers"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "student_transfers_invitation_unique" ON "student_transfers" USING btree ("invitation_id") WHERE "student_transfers"."invitation_id" is not null;--> statement-breakpoint
CREATE INDEX "student_transfers_org_child_requested_idx" ON "student_transfers" USING btree ("organization_id","child_id","requested_at");--> statement-breakpoint
CREATE INDEX "student_transfers_destination_status_idx" ON "student_transfers" USING btree ("organization_id","destination_email","status");