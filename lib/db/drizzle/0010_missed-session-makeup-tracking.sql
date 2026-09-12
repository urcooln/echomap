ALTER TABLE "therapy_sessions" ADD COLUMN "session_status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "missed_reason" text;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "missed_reason_detail" text;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "makeup_status" text;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "makeup_for_session_id" integer;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_makeup_for_session_id_therapy_sessions_id_fk" FOREIGN KEY ("makeup_for_session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "therapy_sessions_makeup_for_unique" ON "therapy_sessions" USING btree ("makeup_for_session_id") WHERE "therapy_sessions"."makeup_for_session_id" is not null and "therapy_sessions"."archived_at" is null;