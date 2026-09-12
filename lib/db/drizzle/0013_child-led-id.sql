ALTER TABLE "child_profiles" ADD COLUMN "child_led_id" text;--> statement-breakpoint
DO $$
DECLARE
  child_profile RECORD;
  candidate text;
BEGIN
  FOR child_profile IN
    SELECT "id"
    FROM "child_profiles"
    WHERE "child_led_id" IS NULL
    ORDER BY "id"
  LOOP
    LOOP
      SELECT 'CLID-' || string_agg(
        substr(
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
          floor(random() * 36)::integer + 1,
          1
        ),
        '' ORDER BY character_index
      )
      INTO candidate
      FROM generate_series(1, 6) AS characters(character_index);

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "child_profiles"
        WHERE lower("child_led_id") = lower(candidate)
      );
    END LOOP;

    UPDATE "child_profiles"
    SET "child_led_id" = candidate
    WHERE "id" = child_profile."id";
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "child_profiles" ALTER COLUMN "child_led_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "child_profiles_child_led_id_lower_unique" ON "child_profiles" USING btree (lower("child_led_id"));--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_child_led_id_format_check" CHECK ("child_profiles"."child_led_id" ~ '^CLID-[A-Z0-9]{6}$');
