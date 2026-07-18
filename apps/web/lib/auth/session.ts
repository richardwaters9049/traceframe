import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDatabaseClient } from "@/lib/db/client";

const SESSION_COOKIE = "traceframe_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function serialiseUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function authenticateUser(email: string, password: string) {
  const sql = getDatabaseClient();
  const [user] = await sql<UserRow[]>`
    SELECT id, email, display_name, role
    FROM users
    WHERE lower(email) = lower(${email})
      AND active = true
      AND password_hash = crypt(${password}, password_hash)
    LIMIT 1
  `;

  return user ? serialiseUser(user) : null;
}

export async function createSession(userId: string) {
  const sql = getDatabaseClient();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await sql.begin(async (transaction) => {
    await transaction`DELETE FROM sessions WHERE expires_at <= now()`;
    await transaction`
      INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES (${tokenHash}, ${userId}, ${expiresAt})
    `;
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
    priority: "high",
  });
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const sql = getDatabaseClient();
  const [user] = await sql<UserRow[]>`
    SELECT u.id, u.email, u.display_name, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.expires_at > now()
      AND u.active = true
    LIMIT 1
  `;

  return user ? serialiseUser(user) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const sql = getDatabaseClient();
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }

  cookieStore.delete(SESSION_COOKIE);
}
