import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const CANONICAL_PHRASE_INDEX_LOCK = 7_340_002;

/**
 * Guarantees the index shape required before canonical phrase repair can run.
 * It is intentionally invoked during API startup, before any route can
 * archive a legacy duplicate and reuse its normalized key.
 */
export const ensureCanonicalGestaltIndex = async () => {
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(${CANONICAL_PHRASE_INDEX_LOCK})`,
    );
    await transaction.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_index AS index_definition
          INNER JOIN pg_class AS index_relation
            ON index_relation.oid = index_definition.indexrelid
          WHERE index_relation.relname = 'clinical_gestalts_child_phrase_unique'
            AND COALESCE(
              pg_get_expr(index_definition.indpred, index_definition.indrelid),
              ''
            ) LIKE '%archived_at IS NULL%'
        ) THEN
          DROP INDEX IF EXISTS clinical_gestalts_child_phrase_unique;
          CREATE UNIQUE INDEX clinical_gestalts_child_phrase_unique
            ON clinical_gestalts (child_id, normalized_phrase)
            WHERE archived_at IS NULL;
        END IF;
      END $$;
    `);
  });
};