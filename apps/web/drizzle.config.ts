import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://traceframe:local-development-only@127.0.0.1:5432/traceframe",
  },
  strict: true,
  verbose: true,
});
