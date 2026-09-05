CREATE TABLE "child_profile_consent_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"confirmed_by" text NOT NULL,
	"statement_version" text NOT NULL,
	"statement" text NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_speaker_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"profile_signature_hash" text NOT NULL,
	"role" text DEFAULT 'unknown' NOT NULL,
	"confidence_score" integer,
	"created_by_user_id" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_matched_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_speaker_role_learning_aggregates" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"role" text NOT NULL,
	"feature_key" text NOT NULL,
	"confirmed_count" integer DEFAULT 0 NOT NULL,
	"model_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_speaker_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"speaker_label" text NOT NULL,
	"role" text DEFAULT 'unassigned' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gestalt_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"gestalt_id" integer,
	"phrase" text NOT NULL,
	"normalized_phrase" text NOT NULL,
	"occurrence_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"audio_id" text NOT NULL,
	"session_id" integer,
	"created_by" text NOT NULL,
	"created_by_user_id" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"provider" text DEFAULT 'openai:gpt-4o-mini-transcribe' NOT NULL,
	"raw_transcript" text DEFAULT '' NOT NULL,
	"speaker_separation_status" text DEFAULT 'pending' NOT NULL,
	"speaker_separation_attempt" integer DEFAULT 0 NOT NULL,
	"speaker_separation_started_at" timestamp with time zone,
	"speaker_separation_completed_at" timestamp with time zone,
	"speaker_separation_failure_code" text,
	"speaker_separation_failure_message" text,
	"error_message" text,
	"occurrence_applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_child_utterance_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"segment_id" integer NOT NULL,
	"disposition" text DEFAULT 'pending' NOT NULL,
	"intelligibility_review_status" text DEFAULT 'pending' NOT NULL,
	"context" text,
	"meaning" text,
	"interpretation" text,
	"note" text,
	"cross_session_label" text,
	"nla_stage" text,
	"nla_stage_assigned_by_user_id" text,
	"nla_stage_assigned_by_role" text,
	"nla_stage_assigned_at" timestamp with time zone,
	"reviewed_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_child_utterance_reviews_nla_stage_check" CHECK ("transcript_child_utterance_reviews"."nla_stage" is null or "transcript_child_utterance_reviews"."nla_stage" in ('stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_4_plus'))
);
--> statement-breakpoint
CREATE TABLE "transcript_phrases" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"phrase" text NOT NULL,
	"normalized_phrase" text NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"matched_gestalt_id" integer,
	"accepted" boolean DEFAULT true NOT NULL,
	"attributed_role" text DEFAULT 'unassigned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_provisional_phrases" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"phrase" text NOT NULL,
	"normalized_phrase" text NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"candidate_kind" text DEFAULT 'potential_phrase' NOT NULL,
	"disposition" text DEFAULT 'pending' NOT NULL,
	"working_meaning" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_speaker_role_inferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"transcript_id" integer NOT NULL,
	"speaker_label" text NOT NULL,
	"state" text NOT NULL,
	"predicted_role" text,
	"confidence_score" integer,
	"competing_role" text,
	"competing_score" integer,
	"margin" integer,
	"signal_count" integer DEFAULT 0 NOT NULL,
	"signal_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_fingerprint" text NOT NULL,
	"model_version" text NOT NULL,
	"feature_version" text NOT NULL,
	"confirmed_role" text,
	"confirmed_by_user_id" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_speaker_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"speaker_label" text NOT NULL,
	"role" text DEFAULT 'unassigned' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_speaker_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"speaker_label" text NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	"speaker_confidence" text DEFAULT 'low' NOT NULL,
	"speaker_confidence_score" integer,
	"intelligibility" text DEFAULT 'intelligible' NOT NULL,
	"transcription_confidence_score" integer,
	"start_time_milliseconds" integer,
	"duration_milliseconds" integer,
	"profile_signature_hash" text,
	"speaker_reviewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_subject_request_placeholders" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"requester_user_id" text NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'placeholder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"scope" text DEFAULT 'organization' NOT NULL,
	"audio_retention_days" integer DEFAULT 365 NOT NULL,
	"observation_video_retention_days" integer DEFAULT 365 NOT NULL,
	"session_note_retention_days" integer DEFAULT 2555 NOT NULL,
	"archived_client_storage_days" integer DEFAULT 365 NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"child_id" integer,
	"outcome" text DEFAULT 'success' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensitive_data_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_type" text NOT NULL,
	"category" text NOT NULL,
	"sensitivity" text DEFAULT 'sensitive' NOT NULL,
	"access_policy" text DEFAULT 'private-child-care-team' NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_child_processing_locks" (
	"child_id" integer PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"lease_id" text NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_request_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"requester_user_id" text NOT NULL,
	"requester_name" text NOT NULL,
	"requester_role" text NOT NULL,
	"categories" text[] NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"reviewed_by_name" text,
	"reviewed_by_role" text,
	"review_note" text,
	"processed_at" timestamp with time zone,
	"processed_categories" text[] DEFAULT '{}' NOT NULL,
	"retained_categories" text[] DEFAULT '{}' NOT NULL,
	"retention_note" text DEFAULT '' NOT NULL,
	"category_progress" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_failure_reason" text,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"processing_lease_id" text,
	"processing_lease_expires_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"automatic_retries_exhausted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_care_team_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"preferred_name" text DEFAULT '' NOT NULL,
	"pronouns" text,
	"date_of_birth" text,
	"school" text DEFAULT '' NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"communication_style" text DEFAULT '' NOT NULL,
	"profile_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_gestalts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"phrase" text NOT NULL,
	"normalized_phrase" text NOT NULL,
	"meaning" text NOT NULL,
	"communication_function" text NOT NULL,
	"contexts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emotional_state" text NOT NULL,
	"source" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"body" text NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"video_object_path" text,
	"video_content_type" text,
	"video_size_bytes" integer,
	"video_consent_confirmed_at" timestamp with time zone,
	"video_consent_confirmed_by_user_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observation_video_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"observation_id" integer,
	"staging_object_path" text NOT NULL,
	"final_object_path" text,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"consent_confirmed_at" timestamp with time zone NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attached_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"beta_approved_at" timestamp with time zone,
	"beta_cohort" text,
	"beta_user_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_audio_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"session_id" integer,
	"preparation_id" text,
	"purpose" text DEFAULT 'session_recording' NOT NULL,
	"calibration_role" text,
	"duration_milliseconds" integer,
	"storage_driver" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'staged' NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"consent_confirmed_at" timestamp with time zone NOT NULL,
	"consent_confirmed_by_user_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_recording_preparations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "therapy_session_gestalts" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"gestalt_id" integer,
	"transcript_phrase_id" integer,
	"phrase_inbox_item_id" integer,
	"child_attributed" boolean DEFAULT false NOT NULL,
	"phrase" text NOT NULL,
	"meaning" text NOT NULL,
	"communication_function" text NOT NULL,
	"context" text NOT NULL,
	"emotional_state" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapy_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"clinical_observations" text DEFAULT '' NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"note" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"identity_provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"archived_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"beta_approved_at" timestamp with time zone,
	"beta_cohort" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gestalt_collaboration_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"gestalt_id" integer NOT NULL,
	"author_user_id" text NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_phrase_observation_recoveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"source_note_id" integer NOT NULL,
	"source_gestalt_id" integer NOT NULL,
	"target_gestalt_id" integer NOT NULL,
	"phrase_observation_id" integer NOT NULL,
	"reviewed_by_user_id" text NOT NULL,
	"reviewed_by_name" text NOT NULL,
	"meaning" text NOT NULL,
	"communication_function" text NOT NULL,
	"context" text NOT NULL,
	"recovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phrase_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"gestalt_id" integer NOT NULL,
	"source_note_id" integer,
	"observed_at" timestamp with time zone NOT NULL,
	"context" text NOT NULL,
	"communication_function" text,
	"author_user_id" text NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_soap_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"content" jsonb NOT NULL,
	"evidence_version" integer DEFAULT 1 NOT NULL,
	"clinician_edited" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"evidence_fingerprint" text,
	"engine_version" text,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clinical_documentation" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"source_session_id" integer,
	"format" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"input_observations" text DEFAULT '' NOT NULL,
	"input_summary" text DEFAULT '' NOT NULL,
	"input_quick_note" text DEFAULT '' NOT NULL,
	"content" jsonb NOT NULL,
	"generated" boolean DEFAULT true NOT NULL,
	"generation_source" text DEFAULT 'clinician_input' NOT NULL,
	"evidence_version" integer DEFAULT 1 NOT NULL,
	"evidence_fingerprint" text,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" text,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "communication_goal_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	"action" text NOT NULL,
	"version" integer NOT NULL,
	"actor_user_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"title" text NOT NULL,
	"goal_area" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"target_date" date,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_knowledge_applied_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"session_id" integer,
	"run_id" integer NOT NULL,
	"category" text NOT NULL,
	"gestalt_id" integer,
	"engine_created_gestalt" boolean DEFAULT false NOT NULL,
	"normalized_phrase" text NOT NULL,
	"phrase" text NOT NULL,
	"meaning" text NOT NULL,
	"communication_function" text NOT NULL,
	"contexts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"confidence" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reverted_by_user_id" text,
	"reverted_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_knowledge_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"source_version_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"page" integer,
	"section" text,
	"encrypted_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_knowledge_ingestion_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_version_id" integer NOT NULL,
	"adapter_id" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"failure_code" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clinical_knowledge_insight_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"trigger_session_id" integer,
	"triggered_by_user_id" text NOT NULL,
	"evidence_fingerprint" text NOT NULL,
	"knowledge_fingerprint" text NOT NULL,
	"engine_version" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"started_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_knowledge_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"session_id" integer,
	"category" text NOT NULL,
	"confidence" text NOT NULL,
	"disposition" text DEFAULT 'draft' NOT NULL,
	"review_reason" text,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_fingerprint" text,
	"engine_version" text,
	"run_id" integer,
	"encrypted_suggestion" text NOT NULL,
	"encrypted_rationale" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"encrypted_clinician_edit" text,
	"encrypted_review_note" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_knowledge_source_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"version" integer NOT NULL,
	"storage_driver" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text NOT NULL,
	"extractor_id" text NOT NULL,
	"extraction_status" text DEFAULT 'processing' NOT NULL,
	"processing_error_code" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_knowledge_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"authorship" text,
	"citation" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"active_version_id" integer,
	"created_by_user_id" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_team_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"invited_email" text NOT NULL,
	"invited_role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"token_hash" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"accepted_by_user_id" text,
	"access_scope" text DEFAULT 'child' NOT NULL,
	"child_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "team_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"sender_user_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"message_type" text DEFAULT 'message' NOT NULL,
	"audience" text DEFAULT 'entire_team' NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_message_reads" (
	"message_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_message_reads_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "aac_vocabulary_planning_merge_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"source_gestalt_id" integer NOT NULL,
	"canonical_gestalt_id" integer NOT NULL,
	"source_status" text NOT NULL,
	"source_created_by_user_id" text NOT NULL,
	"source_created_at" timestamp with time zone NOT NULL,
	"canonical_status" text NOT NULL,
	"canonical_created_by_user_id" text NOT NULL,
	"canonical_created_at" timestamp with time zone NOT NULL,
	"merged_by_user_id" text NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aac_vocabulary_planning" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"gestalt_id" integer NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aac_profile_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"profile_id" integer,
	"action" text NOT NULL,
	"previous_modalities" jsonb,
	"next_modalities" jsonb,
	"previous_other_modality_label" text,
	"next_other_modality_label" text,
	"changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"previous_value" jsonb,
	"next_value" jsonb,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aac_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"communication_modalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"other_modality_label" text,
	"aac_user_status" text DEFAULT 'unknown' NOT NULL,
	"device_vendor_id" text,
	"device_vendor_custom_label" text,
	"device_model_id" text,
	"device_model_custom_label" text,
	"vocabulary_system_id" text,
	"vocabulary_system_custom_label" text,
	"access_method_id" text,
	"access_method_custom_label" text,
	"ownership_id" text,
	"ownership_custom_label" text,
	"notes" text,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_user_id" text,
	"confirmed_by_name" text,
	"confirmed_by_role" text,
	"removed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" text,
	"updated_by_name" text,
	"updated_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_phrase_inbox_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"transcript_id" integer NOT NULL,
	"transcript_phrase_id" integer,
	"segment_id" integer NOT NULL,
	"phrase" text NOT NULL,
	"normalized_phrase" text NOT NULL,
	"review_disposition" text DEFAULT 'child' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"working_meaning" text,
	"reviewed_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_child_profile_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"section" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"author_user_id" text,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shared_child_profile_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"entry_id" integer,
	"section" text NOT NULL,
	"action" text NOT NULL,
	"previous_value" text,
	"next_value" text,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_learning_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"module_key" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"reading_minutes" integer NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"try_this_at_home" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_learning_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"bookmarked" boolean DEFAULT false NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_learning_reflections" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_learning_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"resource_key" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"content_version" text NOT NULL,
	"pdf_object_path" text,
	"pdf_content_type" text,
	"pdf_size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_resource_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"category" text NOT NULL,
	"resource_key" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"reading_minutes" integer NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"format" text DEFAULT 'guide' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_resource_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"bookmarked" boolean DEFAULT false NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"resource_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content_version" text NOT NULL,
	"pdf_object_path" text,
	"pdf_content_type" text,
	"pdf_size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinician_learning_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"module_key" text NOT NULL,
	"category" text NOT NULL,
	"kind" text DEFAULT 'guide' NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"reading_minutes" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"workflow_contexts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinician_learning_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"workflow_coaching_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinician_learning_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"bookmarked" boolean DEFAULT false NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_section_key" text,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinician_learning_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"resource_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dictionary_duplicate_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"first_gestalt_id" integer NOT NULL,
	"second_gestalt_id" integer NOT NULL,
	"evidence_fingerprint" text NOT NULL,
	"decision" text,
	"decision_user_id" text,
	"decision_actor_name" text,
	"decision_actor_role" text,
	"decision_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beta_access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"organization_name" text NOT NULL,
	"requested_role" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"review_notes" text,
	"approved_organization_id" integer,
	"invitation_id" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beta_controls" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"default_cohort" text,
	"default_organization_user_limit" integer,
	"invitation_limit_per_day" integer DEFAULT 25 NOT NULL,
	"current_notice_version" text DEFAULT '1' NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beta_notice_acknowledgements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"notice_version" text NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beta_notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	"created_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "child_speaker_profiles" ADD CONSTRAINT "child_speaker_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_speaker_profiles" ADD CONSTRAINT "child_speaker_profiles_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_speaker_profiles" ADD CONSTRAINT "child_speaker_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_speaker_role_learning_aggregates" ADD CONSTRAINT "child_speaker_role_learning_aggregates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_speaker_role_learning_aggregates" ADD CONSTRAINT "child_speaker_role_learning_aggregates_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_transcripts" ADD CONSTRAINT "session_transcripts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_child_utterance_reviews" ADD CONSTRAINT "transcript_child_utterance_reviews_transcript_id_session_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."session_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_child_utterance_reviews" ADD CONSTRAINT "transcript_child_utterance_reviews_segment_id_transcript_speaker_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."transcript_speaker_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_child_utterance_reviews" ADD CONSTRAINT "transcript_child_utterance_reviews_nla_stage_assigned_by_user_id_users_id_fk" FOREIGN KEY ("nla_stage_assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_child_utterance_reviews" ADD CONSTRAINT "transcript_child_utterance_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_phrases" ADD CONSTRAINT "transcript_phrases_transcript_id_session_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."session_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_provisional_phrases" ADD CONSTRAINT "transcript_provisional_phrases_transcript_id_session_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."session_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_provisional_phrases" ADD CONSTRAINT "transcript_provisional_phrases_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_speaker_role_inferences" ADD CONSTRAINT "transcript_speaker_role_inferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_speaker_role_inferences" ADD CONSTRAINT "transcript_speaker_role_inferences_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_speaker_role_inferences" ADD CONSTRAINT "transcript_speaker_role_inferences_transcript_id_session_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."session_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_speaker_role_inferences" ADD CONSTRAINT "transcript_speaker_role_inferences_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_speaker_roles" ADD CONSTRAINT "transcript_speaker_roles_transcript_id_session_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."session_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_speaker_segments" ADD CONSTRAINT "transcript_speaker_segments_transcript_id_session_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."session_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_settings" ADD CONSTRAINT "retention_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_request_audit_events" ADD CONSTRAINT "deletion_request_audit_events_request_id_deletion_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."deletion_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_care_team_memberships" ADD CONSTRAINT "child_care_team_memberships_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_care_team_memberships" ADD CONSTRAINT "child_care_team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_gestalts" ADD CONSTRAINT "clinical_gestalts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_gestalts" ADD CONSTRAINT "clinical_gestalts_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_gestalts" ADD CONSTRAINT "clinical_gestalts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_observations" ADD CONSTRAINT "clinical_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_observations" ADD CONSTRAINT "clinical_observations_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_observations" ADD CONSTRAINT "clinical_observations_video_consent_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("video_consent_confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_observations" ADD CONSTRAINT "clinical_observations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_video_uploads" ADD CONSTRAINT "observation_video_uploads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_video_uploads" ADD CONSTRAINT "observation_video_uploads_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_video_uploads" ADD CONSTRAINT "observation_video_uploads_observation_id_clinical_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."clinical_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_video_uploads" ADD CONSTRAINT "observation_video_uploads_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_objects" ADD CONSTRAINT "session_audio_objects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_objects" ADD CONSTRAINT "session_audio_objects_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_objects" ADD CONSTRAINT "session_audio_objects_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_objects" ADD CONSTRAINT "session_audio_objects_preparation_id_session_recording_preparations_id_fk" FOREIGN KEY ("preparation_id") REFERENCES "public"."session_recording_preparations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_objects" ADD CONSTRAINT "session_audio_objects_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_objects" ADD CONSTRAINT "session_audio_objects_consent_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("consent_confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recording_preparations" ADD CONSTRAINT "session_recording_preparations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recording_preparations" ADD CONSTRAINT "session_recording_preparations_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recording_preparations" ADD CONSTRAINT "session_recording_preparations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_session_gestalts" ADD CONSTRAINT "therapy_session_gestalts_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_session_gestalts" ADD CONSTRAINT "therapy_session_gestalts_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gestalt_collaboration_notes" ADD CONSTRAINT "gestalt_collaboration_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gestalt_collaboration_notes" ADD CONSTRAINT "gestalt_collaboration_notes_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gestalt_collaboration_notes" ADD CONSTRAINT "gestalt_collaboration_notes_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gestalt_collaboration_notes" ADD CONSTRAINT "gestalt_collaboration_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_phrase_observation_recoveries" ADD CONSTRAINT "legacy_phrase_observation_recoveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_phrase_observation_recoveries" ADD CONSTRAINT "legacy_phrase_observation_recoveries_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_phrase_observation_recoveries" ADD CONSTRAINT "legacy_phrase_observation_recoveries_source_note_id_gestalt_collaboration_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."gestalt_collaboration_notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_phrase_observation_recoveries" ADD CONSTRAINT "legacy_phrase_observation_recoveries_source_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("source_gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_phrase_observation_recoveries" ADD CONSTRAINT "legacy_phrase_observation_recoveries_target_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("target_gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_phrase_observation_recoveries" ADD CONSTRAINT "legacy_phrase_observation_recoveries_phrase_observation_id_phrase_observations_id_fk" FOREIGN KEY ("phrase_observation_id") REFERENCES "public"."phrase_observations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_phrase_observation_recoveries" ADD CONSTRAINT "legacy_phrase_observation_recoveries_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_observations" ADD CONSTRAINT "phrase_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_observations" ADD CONSTRAINT "phrase_observations_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_observations" ADD CONSTRAINT "phrase_observations_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_observations" ADD CONSTRAINT "phrase_observations_source_note_id_gestalt_collaboration_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."gestalt_collaboration_notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_observations" ADD CONSTRAINT "phrase_observations_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_soap_notes" ADD CONSTRAINT "clinical_soap_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_soap_notes" ADD CONSTRAINT "clinical_soap_notes_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_soap_notes" ADD CONSTRAINT "clinical_soap_notes_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_soap_notes" ADD CONSTRAINT "clinical_soap_notes_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_soap_notes" ADD CONSTRAINT "clinical_soap_notes_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_soap_notes" ADD CONSTRAINT "clinical_soap_notes_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_source_session_id_therapy_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documentation" ADD CONSTRAINT "clinical_documentation_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goal_history" ADD CONSTRAINT "communication_goal_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goal_history" ADD CONSTRAINT "communication_goal_history_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goal_history" ADD CONSTRAINT "communication_goal_history_goal_id_communication_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."communication_goals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goal_history" ADD CONSTRAINT "communication_goal_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goals" ADD CONSTRAINT "communication_goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goals" ADD CONSTRAINT "communication_goals_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goals" ADD CONSTRAINT "communication_goals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goals" ADD CONSTRAINT "communication_goals_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_goals" ADD CONSTRAINT "communication_goals_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_applied_facts" ADD CONSTRAINT "clinical_knowledge_applied_facts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_applied_facts" ADD CONSTRAINT "clinical_knowledge_applied_facts_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_applied_facts" ADD CONSTRAINT "clinical_knowledge_applied_facts_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_applied_facts" ADD CONSTRAINT "clinical_knowledge_applied_facts_run_id_clinical_knowledge_insight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."clinical_knowledge_insight_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_applied_facts" ADD CONSTRAINT "clinical_knowledge_applied_facts_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_applied_facts" ADD CONSTRAINT "clinical_knowledge_applied_facts_reverted_by_user_id_users_id_fk" FOREIGN KEY ("reverted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_applied_facts" ADD CONSTRAINT "clinical_knowledge_applied_facts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_chunks" ADD CONSTRAINT "clinical_knowledge_chunks_source_id_clinical_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."clinical_knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_chunks" ADD CONSTRAINT "clinical_knowledge_chunks_source_version_id_clinical_knowledge_source_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."clinical_knowledge_source_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_ingestion_jobs" ADD CONSTRAINT "clinical_knowledge_ingestion_jobs_source_version_id_clinical_knowledge_source_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."clinical_knowledge_source_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insight_runs" ADD CONSTRAINT "clinical_knowledge_insight_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insight_runs" ADD CONSTRAINT "clinical_knowledge_insight_runs_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insight_runs" ADD CONSTRAINT "clinical_knowledge_insight_runs_trigger_session_id_therapy_sessions_id_fk" FOREIGN KEY ("trigger_session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insight_runs" ADD CONSTRAINT "clinical_knowledge_insight_runs_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insights" ADD CONSTRAINT "clinical_knowledge_insights_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insights" ADD CONSTRAINT "clinical_knowledge_insights_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insights" ADD CONSTRAINT "clinical_knowledge_insights_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insights" ADD CONSTRAINT "clinical_knowledge_insights_run_id_clinical_knowledge_insight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."clinical_knowledge_insight_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insights" ADD CONSTRAINT "clinical_knowledge_insights_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_insights" ADD CONSTRAINT "clinical_knowledge_insights_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_source_versions" ADD CONSTRAINT "clinical_knowledge_source_versions_source_id_clinical_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."clinical_knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_source_versions" ADD CONSTRAINT "clinical_knowledge_source_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_sources" ADD CONSTRAINT "clinical_knowledge_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_knowledge_sources" ADD CONSTRAINT "clinical_knowledge_sources_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_invitations" ADD CONSTRAINT "care_team_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_invitations" ADD CONSTRAINT "care_team_invitations_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_invitations" ADD CONSTRAINT "care_team_invitations_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_invitations" ADD CONSTRAINT "care_team_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_message_reads" ADD CONSTRAINT "team_message_reads_message_id_team_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."team_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_message_reads" ADD CONSTRAINT "team_message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning_merge_history" ADD CONSTRAINT "aac_vocabulary_planning_merge_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning_merge_history" ADD CONSTRAINT "aac_vocabulary_planning_merge_history_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning_merge_history" ADD CONSTRAINT "aac_vocabulary_planning_merge_history_source_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("source_gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning_merge_history" ADD CONSTRAINT "aac_vocabulary_planning_merge_history_canonical_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("canonical_gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning" ADD CONSTRAINT "aac_vocabulary_planning_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning" ADD CONSTRAINT "aac_vocabulary_planning_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning" ADD CONSTRAINT "aac_vocabulary_planning_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_vocabulary_planning" ADD CONSTRAINT "aac_vocabulary_planning_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profile_history" ADD CONSTRAINT "aac_profile_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profile_history" ADD CONSTRAINT "aac_profile_history_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profile_history" ADD CONSTRAINT "aac_profile_history_profile_id_aac_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."aac_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profile_history" ADD CONSTRAINT "aac_profile_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profiles" ADD CONSTRAINT "aac_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profiles" ADD CONSTRAINT "aac_profiles_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profiles" ADD CONSTRAINT "aac_profiles_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aac_profiles" ADD CONSTRAINT "aac_profiles_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_phrase_inbox_items" ADD CONSTRAINT "child_phrase_inbox_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_phrase_inbox_items" ADD CONSTRAINT "child_phrase_inbox_items_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_phrase_inbox_items" ADD CONSTRAINT "child_phrase_inbox_items_transcript_id_session_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."session_transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_phrase_inbox_items" ADD CONSTRAINT "child_phrase_inbox_items_segment_id_transcript_speaker_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."transcript_speaker_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_phrase_inbox_items" ADD CONSTRAINT "child_phrase_inbox_items_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_child_profile_entries" ADD CONSTRAINT "shared_child_profile_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_child_profile_entries" ADD CONSTRAINT "shared_child_profile_entries_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_child_profile_entries" ADD CONSTRAINT "shared_child_profile_entries_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_child_profile_history" ADD CONSTRAINT "shared_child_profile_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_child_profile_history" ADD CONSTRAINT "shared_child_profile_history_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_child_profile_history" ADD CONSTRAINT "shared_child_profile_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_modules" ADD CONSTRAINT "parent_learning_modules_resource_id_parent_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."parent_learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_progress" ADD CONSTRAINT "parent_learning_progress_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_progress" ADD CONSTRAINT "parent_learning_progress_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_progress" ADD CONSTRAINT "parent_learning_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_progress" ADD CONSTRAINT "parent_learning_progress_resource_id_parent_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."parent_learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_progress" ADD CONSTRAINT "parent_learning_progress_module_id_parent_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."parent_learning_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_reflections" ADD CONSTRAINT "parent_learning_reflections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_reflections" ADD CONSTRAINT "parent_learning_reflections_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_reflections" ADD CONSTRAINT "parent_learning_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_reflections" ADD CONSTRAINT "parent_learning_reflections_resource_id_parent_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."parent_learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_reflections" ADD CONSTRAINT "parent_learning_reflections_module_id_parent_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."parent_learning_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_learning_resources" ADD CONSTRAINT "parent_learning_resources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_resource_items" ADD CONSTRAINT "teacher_resource_items_resource_id_teacher_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."teacher_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_resource_progress" ADD CONSTRAINT "teacher_resource_progress_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_resource_progress" ADD CONSTRAINT "teacher_resource_progress_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_resource_progress" ADD CONSTRAINT "teacher_resource_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_resource_progress" ADD CONSTRAINT "teacher_resource_progress_resource_id_teacher_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."teacher_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_resource_progress" ADD CONSTRAINT "teacher_resource_progress_item_id_teacher_resource_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."teacher_resource_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_resources" ADD CONSTRAINT "teacher_resources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_modules" ADD CONSTRAINT "clinician_learning_modules_resource_id_clinician_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."clinician_learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_preferences" ADD CONSTRAINT "clinician_learning_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_preferences" ADD CONSTRAINT "clinician_learning_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_progress" ADD CONSTRAINT "clinician_learning_progress_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_progress" ADD CONSTRAINT "clinician_learning_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_progress" ADD CONSTRAINT "clinician_learning_progress_resource_id_clinician_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."clinician_learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_progress" ADD CONSTRAINT "clinician_learning_progress_module_id_clinician_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."clinician_learning_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_learning_resources" ADD CONSTRAINT "clinician_learning_resources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_duplicate_suggestions" ADD CONSTRAINT "dictionary_duplicate_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_duplicate_suggestions" ADD CONSTRAINT "dictionary_duplicate_suggestions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_duplicate_suggestions" ADD CONSTRAINT "dictionary_duplicate_suggestions_first_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("first_gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_duplicate_suggestions" ADD CONSTRAINT "dictionary_duplicate_suggestions_second_gestalt_id_clinical_gestalts_id_fk" FOREIGN KEY ("second_gestalt_id") REFERENCES "public"."clinical_gestalts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_duplicate_suggestions" ADD CONSTRAINT "dictionary_duplicate_suggestions_decision_user_id_users_id_fk" FOREIGN KEY ("decision_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_access_requests" ADD CONSTRAINT "beta_access_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_access_requests" ADD CONSTRAINT "beta_access_requests_approved_organization_id_organizations_id_fk" FOREIGN KEY ("approved_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_controls" ADD CONSTRAINT "beta_controls_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_notice_acknowledgements" ADD CONSTRAINT "beta_notice_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_notices" ADD CONSTRAINT "beta_notices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "child_profile_consent_records_child_id_idx" ON "child_profile_consent_records" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "child_profile_consent_records_user_id_idx" ON "child_profile_consent_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "child_speaker_profiles_child_signature_unique" ON "child_speaker_profiles" USING btree ("child_id","profile_signature_hash");--> statement-breakpoint
CREATE INDEX "child_speaker_profiles_org_child_active_idx" ON "child_speaker_profiles" USING btree ("organization_id","child_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "child_speaker_role_learning_org_child_role_feature_unique" ON "child_speaker_role_learning_aggregates" USING btree ("organization_id","child_id","role","feature_key");--> statement-breakpoint
CREATE UNIQUE INDEX "child_speaker_roles_child_speaker_unique" ON "child_speaker_roles" USING btree ("child_id","speaker_label");--> statement-breakpoint
CREATE UNIQUE INDEX "gestalt_occurrences_child_phrase_unique" ON "gestalt_occurrences" USING btree ("child_id","normalized_phrase");--> statement-breakpoint
CREATE UNIQUE INDEX "session_transcripts_audio_id_unique" ON "session_transcripts" USING btree ("audio_id");--> statement-breakpoint
CREATE INDEX "session_transcripts_owner_child_draft_idx" ON "session_transcripts" USING btree ("created_by_user_id","child_id","session_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_child_utterance_reviews_segment_unique" ON "transcript_child_utterance_reviews" USING btree ("transcript_id","segment_id");--> statement-breakpoint
CREATE INDEX "transcript_child_utterance_reviews_transcript_idx" ON "transcript_child_utterance_reviews" USING btree ("transcript_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_phrases_transcript_phrase_unique" ON "transcript_phrases" USING btree ("transcript_id","normalized_phrase");--> statement-breakpoint
CREATE INDEX "transcript_provisional_phrases_transcript_idx" ON "transcript_provisional_phrases" USING btree ("transcript_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_speaker_role_inferences_transcript_label_unique" ON "transcript_speaker_role_inferences" USING btree ("transcript_id","speaker_label");--> statement-breakpoint
CREATE INDEX "transcript_speaker_role_inferences_org_child_idx" ON "transcript_speaker_role_inferences" USING btree ("organization_id","child_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_speaker_roles_transcript_speaker_unique" ON "transcript_speaker_roles" USING btree ("transcript_id","speaker_label");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_speaker_segments_position_unique" ON "transcript_speaker_segments" USING btree ("transcript_id","position");--> statement-breakpoint
CREATE INDEX "data_subject_request_placeholders_child_id_idx" ON "data_subject_request_placeholders" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "data_subject_request_placeholders_requester_id_idx" ON "data_subject_request_placeholders" USING btree ("requester_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_settings_org_scope_unique" ON "retention_settings" USING btree ("organization_id","scope");--> statement-breakpoint
CREATE INDEX "security_audit_logs_occurred_at_idx" ON "security_audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "security_audit_logs_user_id_idx" ON "security_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_audit_logs_child_id_idx" ON "security_audit_logs" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "security_audit_logs_action_idx" ON "security_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "sensitive_data_classifications_type_unique" ON "sensitive_data_classifications" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "deletion_request_audit_events_request_id_idx" ON "deletion_request_audit_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "deletion_requests_child_id_idx" ON "deletion_requests" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "deletion_requests_requester_user_id_idx" ON "deletion_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "child_care_team_child_user_unique" ON "child_care_team_memberships" USING btree ("child_id","user_id");--> statement-breakpoint
CREATE INDEX "child_care_team_user_active_idx" ON "child_care_team_memberships" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "child_profiles_org_active_idx" ON "child_profiles" USING btree ("organization_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_gestalts_child_phrase_unique" ON "clinical_gestalts" USING btree ("child_id","normalized_phrase") WHERE "clinical_gestalts"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "clinical_gestalts_org_child_active_idx" ON "clinical_gestalts" USING btree ("organization_id","child_id","archived_at");--> statement-breakpoint
CREATE INDEX "clinical_observations_org_child_created_idx" ON "clinical_observations" USING btree ("organization_id","child_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "observation_video_uploads_staging_path_unique" ON "observation_video_uploads" USING btree ("staging_object_path");--> statement-breakpoint
CREATE INDEX "observation_video_uploads_org_child_status_idx" ON "observation_video_uploads" USING btree ("organization_id","child_id","status");--> statement-breakpoint
CREATE INDEX "observation_video_uploads_expiry_idx" ON "observation_video_uploads" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_org_user_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_active_idx" ON "organization_memberships" USING btree ("user_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "session_audio_objects_driver_key_unique" ON "session_audio_objects" USING btree ("storage_driver","object_key");--> statement-breakpoint
CREATE INDEX "session_audio_objects_org_child_status_idx" ON "session_audio_objects" USING btree ("organization_id","child_id","status");--> statement-breakpoint
CREATE INDEX "session_audio_objects_session_idx" ON "session_audio_objects" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_audio_objects_preparation_idx" ON "session_audio_objects" USING btree ("preparation_id");--> statement-breakpoint
CREATE INDEX "session_recording_preparations_owner_idx" ON "session_recording_preparations" USING btree ("organization_id","child_id","created_by_user_id","status");--> statement-breakpoint
CREATE INDEX "therapy_session_gestalts_session_idx" ON "therapy_session_gestalts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "therapy_sessions_org_child_created_idx" ON "therapy_sessions" USING btree ("organization_id","child_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_subject_unique" ON "users" USING btree ("identity_provider","provider_subject");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "gestalt_collaboration_notes_org_child_idx" ON "gestalt_collaboration_notes" USING btree ("organization_id","child_id","created_at");--> statement-breakpoint
CREATE INDEX "gestalt_collaboration_notes_gestalt_idx" ON "gestalt_collaboration_notes" USING btree ("gestalt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_phrase_observation_recoveries_note_unique" ON "legacy_phrase_observation_recoveries" USING btree ("source_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_phrase_observation_recoveries_observation_unique" ON "legacy_phrase_observation_recoveries" USING btree ("phrase_observation_id");--> statement-breakpoint
CREATE INDEX "legacy_phrase_observation_recoveries_org_child_idx" ON "legacy_phrase_observation_recoveries" USING btree ("organization_id","child_id","recovered_at");--> statement-breakpoint
CREATE INDEX "phrase_observations_org_child_observed_idx" ON "phrase_observations" USING btree ("organization_id","child_id","observed_at");--> statement-breakpoint
CREATE INDEX "phrase_observations_gestalt_idx" ON "phrase_observations" USING btree ("gestalt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phrase_observations_source_note_unique" ON "phrase_observations" USING btree ("source_note_id") WHERE "phrase_observations"."source_note_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_soap_notes_session_unique" ON "clinical_soap_notes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "clinical_soap_notes_org_child_idx" ON "clinical_soap_notes" USING btree ("organization_id","child_id");--> statement-breakpoint
CREATE INDEX "clinical_soap_notes_lifecycle_idx" ON "clinical_soap_notes" USING btree ("organization_id","status","purge_after");--> statement-breakpoint
CREATE INDEX "clinical_documentation_org_child_updated_idx" ON "clinical_documentation" USING btree ("organization_id","child_id","updated_at");--> statement-breakpoint
CREATE INDEX "clinical_documentation_source_session_idx" ON "clinical_documentation" USING btree ("source_session_id");--> statement-breakpoint
CREATE INDEX "clinical_documentation_lifecycle_idx" ON "clinical_documentation" USING btree ("organization_id","status","purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_documentation_active_ai_summary_unique" ON "clinical_documentation" USING btree ("organization_id","child_id","source_session_id","generation_source") WHERE "clinical_documentation"."status" = 'draft' and "clinical_documentation"."generation_source" = 'ai_confirmed_child_language_v2';--> statement-breakpoint
CREATE INDEX "communication_goal_history_goal_idx" ON "communication_goal_history" USING btree ("goal_id","occurred_at");--> statement-breakpoint
CREATE INDEX "communication_goals_org_child_status_idx" ON "communication_goals" USING btree ("organization_id","child_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_knowledge_applied_fact_run_phrase_unique" ON "clinical_knowledge_applied_facts" USING btree ("run_id","category","normalized_phrase");--> statement-breakpoint
CREATE INDEX "clinical_knowledge_applied_facts_org_child_idx" ON "clinical_knowledge_applied_facts" USING btree ("organization_id","child_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_knowledge_chunk_ordinal_unique" ON "clinical_knowledge_chunks" USING btree ("source_version_id","ordinal");--> statement-breakpoint
CREATE INDEX "clinical_knowledge_chunks_source_idx" ON "clinical_knowledge_chunks" USING btree ("source_id","source_version_id");--> statement-breakpoint
CREATE INDEX "clinical_knowledge_ingestion_status_idx" ON "clinical_knowledge_ingestion_jobs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_knowledge_insight_run_fingerprint_unique" ON "clinical_knowledge_insight_runs" USING btree ("organization_id","child_id","evidence_fingerprint","knowledge_fingerprint","engine_version");--> statement-breakpoint
CREATE INDEX "clinical_knowledge_insight_runs_org_child_idx" ON "clinical_knowledge_insight_runs" USING btree ("organization_id","child_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_knowledge_insight_run_category_unique" ON "clinical_knowledge_insights" USING btree ("run_id","category");--> statement-breakpoint
CREATE INDEX "clinical_knowledge_insights_org_child_idx" ON "clinical_knowledge_insights" USING btree ("organization_id","child_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_knowledge_source_version_unique" ON "clinical_knowledge_source_versions" USING btree ("source_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_knowledge_source_storage_unique" ON "clinical_knowledge_source_versions" USING btree ("storage_driver","storage_key");--> statement-breakpoint
CREATE INDEX "clinical_knowledge_sources_org_status_idx" ON "clinical_knowledge_sources" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "care_team_invitations_org_child_idx" ON "care_team_invitations" USING btree ("organization_id","child_id");--> statement-breakpoint
CREATE INDEX "care_team_invitations_email_idx" ON "care_team_invitations" USING btree ("invited_email");--> statement-breakpoint
CREATE UNIQUE INDEX "care_team_invitations_token_hash_unique" ON "care_team_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "care_team_invitations_pending_email_idx" ON "care_team_invitations" USING btree ("organization_id","invited_email","status");--> statement-breakpoint
CREATE INDEX "team_messages_org_child_created_idx" ON "team_messages" USING btree ("organization_id","child_id","created_at");--> statement-breakpoint
CREATE INDEX "team_messages_sender_idx" ON "team_messages" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "team_message_reads_user_idx" ON "team_message_reads" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "aac_vocabulary_planning_merge_history_child_idx" ON "aac_vocabulary_planning_merge_history" USING btree ("organization_id","child_id","merged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "aac_vocabulary_planning_child_gestalt_unique" ON "aac_vocabulary_planning" USING btree ("child_id","gestalt_id");--> statement-breakpoint
CREATE INDEX "aac_vocabulary_planning_org_child_status_idx" ON "aac_vocabulary_planning" USING btree ("organization_id","child_id","status");--> statement-breakpoint
CREATE INDEX "aac_profile_history_org_child_idx" ON "aac_profile_history" USING btree ("organization_id","child_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "aac_profiles_org_child_unique" ON "aac_profiles" USING btree ("organization_id","child_id");--> statement-breakpoint
CREATE INDEX "aac_profiles_child_idx" ON "aac_profiles" USING btree ("child_id");--> statement-breakpoint
CREATE UNIQUE INDEX "child_phrase_inbox_transcript_segment_unique" ON "child_phrase_inbox_items" USING btree ("transcript_id","segment_id");--> statement-breakpoint
CREATE INDEX "child_phrase_inbox_org_child_status_idx" ON "child_phrase_inbox_items" USING btree ("organization_id","child_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "child_phrase_inbox_transcript_idx" ON "child_phrase_inbox_items" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "shared_child_profile_entries_org_child_idx" ON "shared_child_profile_entries" USING btree ("organization_id","child_id","section","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_child_profile_entries_active_value_unique" ON "shared_child_profile_entries" USING btree ("organization_id","child_id","section","category","normalized_value") WHERE "shared_child_profile_entries"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "shared_child_profile_history_org_child_idx" ON "shared_child_profile_history" USING btree ("organization_id","child_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_learning_modules_resource_key_unique" ON "parent_learning_modules" USING btree ("resource_id","module_key");--> statement-breakpoint
CREATE INDEX "parent_learning_modules_resource_position_idx" ON "parent_learning_modules" USING btree ("resource_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_learning_progress_user_child_module_unique" ON "parent_learning_progress" USING btree ("user_id","child_id","module_id");--> statement-breakpoint
CREATE INDEX "parent_learning_progress_scope_idx" ON "parent_learning_progress" USING btree ("organization_id","child_id","user_id");--> statement-breakpoint
CREATE INDEX "parent_learning_progress_last_viewed_idx" ON "parent_learning_progress" USING btree ("user_id","child_id","last_viewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_learning_reflections_user_child_module_unique" ON "parent_learning_reflections" USING btree ("user_id","child_id","module_id");--> statement-breakpoint
CREATE INDEX "parent_learning_reflections_scope_idx" ON "parent_learning_reflections" USING btree ("organization_id","child_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_learning_resources_org_key_unique" ON "parent_learning_resources" USING btree ("organization_id","resource_key");--> statement-breakpoint
CREATE INDEX "parent_learning_resources_org_idx" ON "parent_learning_resources" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_resource_items_resource_key_unique" ON "teacher_resource_items" USING btree ("resource_id","resource_key");--> statement-breakpoint
CREATE INDEX "teacher_resource_items_category_idx" ON "teacher_resource_items" USING btree ("resource_id","category","position");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_resource_progress_user_child_item_unique" ON "teacher_resource_progress" USING btree ("user_id","child_id","item_id");--> statement-breakpoint
CREATE INDEX "teacher_resource_progress_scope_idx" ON "teacher_resource_progress" USING btree ("organization_id","child_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_resources_org_key_unique" ON "teacher_resources" USING btree ("organization_id","resource_key");--> statement-breakpoint
CREATE INDEX "teacher_resources_org_idx" ON "teacher_resources" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clinician_learning_modules_resource_key_unique" ON "clinician_learning_modules" USING btree ("resource_id","module_key");--> statement-breakpoint
CREATE INDEX "clinician_learning_modules_category_idx" ON "clinician_learning_modules" USING btree ("resource_id","category","position");--> statement-breakpoint
CREATE UNIQUE INDEX "clinician_learning_preferences_org_user_unique" ON "clinician_learning_preferences" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "clinician_learning_preferences_org_idx" ON "clinician_learning_preferences" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clinician_learning_progress_org_user_module_unique" ON "clinician_learning_progress" USING btree ("organization_id","user_id","module_id");--> statement-breakpoint
CREATE INDEX "clinician_learning_progress_scope_idx" ON "clinician_learning_progress" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clinician_learning_resources_org_key_unique" ON "clinician_learning_resources" USING btree ("organization_id","resource_key");--> statement-breakpoint
CREATE INDEX "clinician_learning_resources_org_idx" ON "clinician_learning_resources" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dictionary_duplicate_suggestions_pair_unique" ON "dictionary_duplicate_suggestions" USING btree ("organization_id","child_id","first_gestalt_id","second_gestalt_id");--> statement-breakpoint
CREATE INDEX "dictionary_duplicate_suggestions_org_child_idx" ON "dictionary_duplicate_suggestions" USING btree ("organization_id","child_id","decision");--> statement-breakpoint
CREATE INDEX "beta_access_requests_status_created_idx" ON "beta_access_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "beta_access_requests_email_idx" ON "beta_access_requests" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "beta_notice_acknowledgements_user_version_unique" ON "beta_notice_acknowledgements" USING btree ("user_id","notice_version");--> statement-breakpoint
CREATE INDEX "beta_notice_acknowledgements_user_idx" ON "beta_notice_acknowledgements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "beta_notices_version_unique" ON "beta_notices" USING btree ("version");