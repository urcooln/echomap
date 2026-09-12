CREATE TABLE "team_conversation_participants" (
	"conversation_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	CONSTRAINT "team_conversation_participants_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"participant_key" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_messages" ADD COLUMN "conversation_id" integer;--> statement-breakpoint
ALTER TABLE "team_conversation_participants" ADD CONSTRAINT "team_conversation_participants_conversation_id_team_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."team_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_conversation_participants" ADD CONSTRAINT "team_conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_conversations" ADD CONSTRAINT "team_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_conversations" ADD CONSTRAINT "team_conversations_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_conversations" ADD CONSTRAINT "team_conversations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_conversation_participants_user_idx" ON "team_conversation_participants" USING btree ("user_id","conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_conversations_child_participants_unique" ON "team_conversations" USING btree ("organization_id","child_id","participant_key");--> statement-breakpoint
CREATE INDEX "team_conversations_org_child_updated_idx" ON "team_conversations" USING btree ("organization_id","child_id","updated_at");--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_conversation_id_team_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."team_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_messages_conversation_created_idx" ON "team_messages" USING btree ("conversation_id","created_at");
--> statement-breakpoint
WITH message_participants AS (
	SELECT
		message.id AS message_id,
		message.organization_id,
		message.child_id,
		message.sender_user_id AS user_id,
		message.sender_role AS role
	FROM team_messages message
	WHERE message.message_type <> 'notification'
	UNION ALL
	SELECT
		message.id,
		message.organization_id,
		message.child_id,
		message.recipient_user_id,
		coalesce(membership.role, organization_membership.role, 'care_team')
	FROM team_messages message
	LEFT JOIN child_care_team_memberships membership
		ON membership.child_id = message.child_id
		AND membership.user_id = message.recipient_user_id
	LEFT JOIN organization_memberships organization_membership
		ON organization_membership.organization_id = message.organization_id
		AND organization_membership.user_id = message.recipient_user_id
	WHERE message.message_type <> 'notification'
		AND message.recipient_user_id IS NOT NULL
	UNION ALL
	SELECT
		message.id,
		message.organization_id,
		message.child_id,
		membership.user_id,
		membership.role
	FROM team_messages message
	JOIN child_care_team_memberships membership
		ON membership.child_id = message.child_id
		AND membership.active = true
	WHERE message.message_type <> 'notification'
		AND message.recipient_user_id IS NULL
), message_sets AS (
	SELECT
		message_id,
		organization_id,
		child_id,
		string_agg(DISTINCT user_id, ':' ORDER BY user_id) AS participant_key
	FROM message_participants
	GROUP BY message_id, organization_id, child_id
), conversation_sets AS (
	SELECT
		message_set.organization_id,
		message_set.child_id,
		message_set.participant_key,
		min(message.sender_user_id) AS created_by_user_id,
		min(message.created_at) AS created_at,
		max(message.created_at) AS updated_at
	FROM message_sets message_set
	JOIN team_messages message ON message.id = message_set.message_id
	GROUP BY
		message_set.organization_id,
		message_set.child_id,
		message_set.participant_key
)
INSERT INTO team_conversations (
	organization_id,
	child_id,
	participant_key,
	created_by_user_id,
	created_at,
	updated_at
)
SELECT
	organization_id,
	child_id,
	participant_key,
	created_by_user_id,
	created_at,
	updated_at
FROM conversation_sets
ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH message_participants AS (
	SELECT message.id AS message_id, message.organization_id, message.child_id,
		message.sender_user_id AS user_id, message.sender_role AS role
	FROM team_messages message
	WHERE message.message_type <> 'notification'
	UNION ALL
	SELECT message.id, message.organization_id, message.child_id,
		message.recipient_user_id,
		coalesce(membership.role, organization_membership.role, 'care_team')
	FROM team_messages message
	LEFT JOIN child_care_team_memberships membership
		ON membership.child_id = message.child_id
		AND membership.user_id = message.recipient_user_id
	LEFT JOIN organization_memberships organization_membership
		ON organization_membership.organization_id = message.organization_id
		AND organization_membership.user_id = message.recipient_user_id
	WHERE message.message_type <> 'notification'
		AND message.recipient_user_id IS NOT NULL
	UNION ALL
	SELECT message.id, message.organization_id, message.child_id,
		membership.user_id, membership.role
	FROM team_messages message
	JOIN child_care_team_memberships membership
		ON membership.child_id = message.child_id AND membership.active = true
	WHERE message.message_type <> 'notification'
		AND message.recipient_user_id IS NULL
), message_sets AS (
	SELECT message_id, organization_id, child_id,
		string_agg(DISTINCT user_id, ':' ORDER BY user_id) AS participant_key
	FROM message_participants
	GROUP BY message_id, organization_id, child_id
), participant_rows AS (
	SELECT conversation.id AS conversation_id, participant.user_id, participant.role
	FROM message_participants participant
	JOIN message_sets message_set ON message_set.message_id = participant.message_id
	JOIN team_conversations conversation
		ON conversation.organization_id = message_set.organization_id
		AND conversation.child_id = message_set.child_id
		AND conversation.participant_key = message_set.participant_key
)
INSERT INTO team_conversation_participants (conversation_id, user_id, role)
SELECT conversation_id, user_id, min(role)
FROM participant_rows
GROUP BY conversation_id, user_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE team_messages message
SET conversation_id = conversation.id
FROM (
	SELECT message_set.message_id, matched_conversation.id
	FROM (
		SELECT
			participant.message_id,
			participant.organization_id,
			participant.child_id,
			string_agg(DISTINCT participant.user_id, ':' ORDER BY participant.user_id) AS participant_key
		FROM (
			SELECT message.id AS message_id, message.organization_id, message.child_id,
				message.sender_user_id AS user_id
			FROM team_messages message
			WHERE message.message_type <> 'notification'
			UNION ALL
			SELECT message.id, message.organization_id, message.child_id,
				message.recipient_user_id
			FROM team_messages message
			WHERE message.message_type <> 'notification'
				AND message.recipient_user_id IS NOT NULL
			UNION ALL
			SELECT message.id, message.organization_id, message.child_id,
				membership.user_id
			FROM team_messages message
			JOIN child_care_team_memberships membership
				ON membership.child_id = message.child_id AND membership.active = true
			WHERE message.message_type <> 'notification'
				AND message.recipient_user_id IS NULL
		) participant
		GROUP BY participant.message_id, participant.organization_id, participant.child_id
	) message_set
	JOIN team_conversations matched_conversation
		ON matched_conversation.organization_id = message_set.organization_id
		AND matched_conversation.child_id = message_set.child_id
		AND matched_conversation.participant_key = message_set.participant_key
) conversation
WHERE message.conversation_id IS NULL
	AND message.message_type <> 'notification'
	AND conversation.message_id = message.id;
