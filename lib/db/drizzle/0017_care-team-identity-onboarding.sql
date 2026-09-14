UPDATE "organization_memberships" AS "membership"
SET
  "account_status" = 'onboarding',
  "onboarding_completed_at" = NULL,
  "updated_at" = now()
FROM "users" AS "user"
WHERE
  "membership"."user_id" = "user"."id"
  AND "membership"."active" = true
  AND "membership"."role" IN ('parent', 'teacher')
  AND "user"."identity_provider" = 'clerk'
  AND "user"."archived_at" IS NULL;
