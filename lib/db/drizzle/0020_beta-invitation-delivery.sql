ALTER TABLE "beta_access_requests" ADD COLUMN "invitation_sent_at" timestamp with time zone;
UPDATE "beta_access_requests" AS request
SET "invitation_sent_at" = invitation."created_at"
FROM "care_team_invitations" AS invitation
WHERE request."invitation_id" = invitation."id"
  AND request."status" = 'approved';
