ALTER TABLE "session_transcripts" ADD COLUMN "service_requirement_id" integer;--> statement-breakpoint
ALTER TABLE "session_transcripts" ADD COLUMN "makeup_for_session_id" integer;--> statement-breakpoint
ALTER TABLE "session_transcripts" ADD CONSTRAINT "session_transcripts_service_requirement_id_iep_service_requirements_id_fk" FOREIGN KEY ("service_requirement_id") REFERENCES "public"."iep_service_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_transcripts" ADD CONSTRAINT "session_transcripts_makeup_for_session_id_therapy_sessions_id_fk" FOREIGN KEY ("makeup_for_session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_transcripts_service_idx" ON "session_transcripts" USING btree ("service_requirement_id");--> statement-breakpoint
CREATE INDEX "session_transcripts_makeup_for_idx" ON "session_transcripts" USING btree ("makeup_for_session_id");
