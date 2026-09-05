import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply database migrations.");
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15_000,
  max: 1,
});

const printableDatabaseError = (error) => {
  if (!(error instanceof Error)) return { message: String(error) };

  const cause = error.cause instanceof Error ? error.cause : error;
  return {
    name: cause.name,
    message: cause.message,
    code: cause.code,
    detail: cause.detail,
    hint: cause.hint,
    position: cause.position,
    schema: cause.schema,
    table: cause.table,
    constraint: cause.constraint,
  };
};

try {
  const connection = await pool.query(`
    select
      current_database() as database,
      current_user as user,
      current_setting('server_version') as server_version,
      has_schema_privilege(current_user, 'public', 'CREATE') as can_create
  `);
  const tableCount = await pool.query(`
    select count(*)::integer as count
    from information_schema.tables
    where table_schema = 'public'
  `);

  console.log("Database migration preflight:", {
    ...connection.rows[0],
    public_table_count: tableCount.rows[0].count,
  });

  const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
  await migrate(drizzle(pool), { migrationsFolder });
  console.log("Database migrations applied successfully.");
} catch (error) {
  console.error("Database migration failed:", printableDatabaseError(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
