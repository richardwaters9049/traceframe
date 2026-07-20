import "server-only";

import { getDatabaseClient } from "@/lib/db/client";

const WINDOW_MINUTES = 15;
const BLOCK_AFTER_FAILURES = 5;
const MAX_DELAY_MS = 800;

export async function checkLoginThrottle(identityHash: string) {
  const sql = getDatabaseClient();
  const [row] = await sql<{ failures: number; blocked: boolean }[]>`
    SELECT failures, blocked_until IS NOT NULL AND blocked_until > now() AS blocked
    FROM login_throttle WHERE identity_hash = ${identityHash}`;
  return { blocked: row?.blocked ?? false, delayMs: Math.min(MAX_DELAY_MS, Math.max(0, (row?.failures ?? 0) - 1) * 200) };
}

export async function recordLoginFailure(identityHash: string) {
  const sql = getDatabaseClient();
  await sql`
    INSERT INTO login_throttle (identity_hash, failures, window_started_at, blocked_until, updated_at)
    VALUES (${identityHash}, 1, now(), NULL, now())
    ON CONFLICT (identity_hash) DO UPDATE SET
      failures = CASE
        WHEN login_throttle.window_started_at < now() - (${WINDOW_MINUTES} * interval '1 minute') THEN 1
        ELSE login_throttle.failures + 1
      END,
      window_started_at = CASE
        WHEN login_throttle.window_started_at < now() - (${WINDOW_MINUTES} * interval '1 minute') THEN now()
        ELSE login_throttle.window_started_at
      END,
      blocked_until = CASE
        WHEN (CASE WHEN login_throttle.window_started_at < now() - (${WINDOW_MINUTES} * interval '1 minute') THEN 1 ELSE login_throttle.failures + 1 END) >= ${BLOCK_AFTER_FAILURES}
          THEN now() + (${WINDOW_MINUTES} * interval '1 minute')
        ELSE NULL
      END,
      updated_at = now()`;
}

export async function clearLoginThrottle(identityHash: string) {
  const sql = getDatabaseClient();
  await sql`DELETE FROM login_throttle WHERE identity_hash = ${identityHash}`;
}

export async function applyProgressiveDelay(milliseconds: number) {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
