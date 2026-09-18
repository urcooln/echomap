CREATE TABLE "school_districts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_district_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_user_id" text NOT NULL,
	"district_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "district_id" integer;--> statement-breakpoint
ALTER TABLE "slp_profiles" ADD COLUMN "district_id" integer;--> statement-breakpoint
ALTER TABLE "teacher_district_memberships" ADD CONSTRAINT "teacher_district_memberships_teacher_user_id_users_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_district_memberships" ADD CONSTRAINT "teacher_district_memberships_district_id_school_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."school_districts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "school_districts_name_lower_unique" ON "school_districts" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_district_memberships_user_district_unique" ON "teacher_district_memberships" USING btree ("teacher_user_id","district_id");--> statement-breakpoint
CREATE INDEX "teacher_district_memberships_district_idx" ON "teacher_district_memberships" USING btree ("district_id");--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_district_id_school_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."school_districts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slp_profiles" ADD CONSTRAINT "slp_profiles_district_id_school_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."school_districts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slp_profiles_district_idx" ON "slp_profiles" USING btree ("district_id");
--> statement-breakpoint
INSERT INTO "school_districts" ("name", "active")
VALUES ('Burlington County Special Services', true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "slp_profiles" AS slp
SET "district_id" = district."id"
FROM "school_districts" AS district
WHERE lower(trim(slp."school_district")) = lower(district."name")
  AND slp."district_id" IS NULL;
--> statement-breakpoint
UPDATE "child_profiles" AS child
SET "district_id" = slp."district_id"
FROM "child_care_team_memberships" AS team,
     "slp_profiles" AS slp
WHERE child."id" = team."child_id"
  AND child."organization_id" = slp."organization_id"
  AND team."user_id" = slp."user_id"
  AND team."role" = 'clinician'
  AND team."active" = true
  AND slp."district_id" IS NOT NULL
  AND child."district_id" IS NULL
  AND (SELECT count(*) FROM "child_care_team_memberships" AS all_clinicians
       WHERE all_clinicians."child_id" = child."id"
         AND all_clinicians."role" = 'clinician'
         AND all_clinicians."active" = true) = 1;
--> statement-breakpoint
INSERT INTO "teacher_district_memberships" ("teacher_user_id", "district_id")
SELECT DISTINCT team."user_id", child."district_id"
FROM "child_care_team_memberships" AS team
JOIN "child_profiles" AS child ON child."id" = team."child_id"
WHERE team."role" = 'teacher' AND team."active" = true
  AND child."district_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION sync_teacher_district_membership() RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'teacher' AND NEW.active THEN
    INSERT INTO teacher_district_memberships (teacher_user_id, district_id)
    SELECT NEW.user_id, child.district_id
    FROM child_profiles AS child
    WHERE child.id = NEW.child_id AND child.district_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER child_team_teacher_district_sync
AFTER INSERT OR UPDATE OF role, active, child_id ON child_care_team_memberships
FOR EACH ROW EXECUTE FUNCTION sync_teacher_district_membership();
--> statement-breakpoint
CREATE FUNCTION sync_child_teacher_district_memberships() RETURNS trigger AS $$
BEGIN
  IF NEW.district_id IS NOT NULL AND NEW.district_id IS DISTINCT FROM OLD.district_id THEN
    INSERT INTO teacher_district_memberships (teacher_user_id, district_id)
    SELECT team.user_id, NEW.district_id
    FROM child_care_team_memberships AS team
    WHERE team.child_id = NEW.id AND team.role = 'teacher' AND team.active = true
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER child_district_teacher_sync
AFTER UPDATE OF district_id ON child_profiles
FOR EACH ROW EXECUTE FUNCTION sync_child_teacher_district_memberships();
