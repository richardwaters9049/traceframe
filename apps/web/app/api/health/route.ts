import { getDatabaseClient } from "@/lib/db/client";

export async function GET() {
  try {
    const sql = getDatabaseClient();
    await sql`SELECT 1`;

    return Response.json(
      {
        status: "ok",
        service: "traceframe-web",
        dependencies: { database: "available" },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Traceframe health check failed", error);

    return Response.json(
      {
        status: "degraded",
        service: "traceframe-web",
        dependencies: { database: "unavailable" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
