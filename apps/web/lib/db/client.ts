import postgres from "postgres";

const globalForDatabase = globalThis as unknown as {
  traceframeSql?: ReturnType<typeof postgres>;
};

export function getDatabaseClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const sql =
    globalForDatabase.traceframeSql ??
    postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

  // Reuse one bounded pool per server process. Creating a pool per production
  // request leaks connections and can exhaust PostgreSQL under parallel load.
  globalForDatabase.traceframeSql = sql;

  return sql;
}
