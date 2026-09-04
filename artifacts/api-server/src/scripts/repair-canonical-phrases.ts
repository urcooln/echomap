import { clinicalGestaltsTable, db, pool } from "@workspace/db";
import { isNull, sql } from "drizzle-orm";
import { ensureCanonicalGestaltIndex } from "../lib/canonical-gestalt-index";
import { repairCanonicalGestaltsForChild } from "../lib/canonical-gestalt-repair";

await ensureCanonicalGestaltIndex();

const activeChildren = await db
  .selectDistinct({
    organizationId: clinicalGestaltsTable.organizationId,
    childId: clinicalGestaltsTable.childId,
  })
  .from(clinicalGestaltsTable)
  .where(isNull(clinicalGestaltsTable.archivedAt));

let archivedCount = 0;
for (const child of activeChildren) {
  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(${child.organizationId}, ${child.childId})`,
    );
    return repairCanonicalGestaltsForChild(
      transaction,
      child.organizationId,
      child.childId,
    );
  });
  archivedCount += result.archivedCount;
}

console.info(`Canonical phrase repair completed: ${archivedCount} duplicate records archived.`);
await pool.end();