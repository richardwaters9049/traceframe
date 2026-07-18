import { cookies } from "next/headers";

import { deleteSession } from "@/lib/auth/session";

export async function POST() {
  await deleteSession();
  (await cookies()).set("traceframe_skip_intro", "1", {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    maxAge: 15,
    path: "/",
  });
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
