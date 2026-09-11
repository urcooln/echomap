DROP INDEX IF EXISTS "iep_service_requirements_child_service_unique";--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "service_requirement_id" integer;--> statement-breakpoint
ALTER TABLE "iep_service_requirements" ADD COLUMN "service_type" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "iep_service_requirements" ADD COLUMN "custom_frequency_description" text;--> statement-breakpoint
UPDATE "iep_service_requirements"
SET "period" = 'custom',
    "custom_frequency_description" = COALESCE("custom_frequency_description", 'Legacy reporting / IEP period')
WHERE "period" = 'reporting_period';--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_service_requirement_id_iep_service_requirements_id_fk" FOREIGN KEY ("service_requirement_id") REFERENCES "public"."iep_service_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "therapy_sessions_service_date_idx" ON "therapy_sessions" USING btree ("organization_id","service_requirement_id","session_date");--> statement-breakpoint
CREATE INDEX "iep_service_requirements_child_service_idx" ON "iep_service_requirements" USING btree ("organization_id","child_id","service_type","effective_from");
