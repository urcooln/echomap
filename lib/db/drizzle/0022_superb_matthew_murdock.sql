CREATE TABLE "slp_recording_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"audio_id" text NOT NULL,
	"user_id" text NOT NULL,
	"period_start" date NOT NULL,
	"duration_milliseconds" integer NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slp_recording_usage" ADD CONSTRAINT "slp_recording_usage_audio_id_session_audio_objects_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."session_audio_objects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slp_recording_usage" ADD CONSTRAINT "slp_recording_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slp_recording_usage_audio_unique" ON "slp_recording_usage" USING btree ("audio_id");--> statement-breakpoint
CREATE INDEX "slp_recording_usage_user_period_idx" ON "slp_recording_usage" USING btree ("user_id","period_start","status");