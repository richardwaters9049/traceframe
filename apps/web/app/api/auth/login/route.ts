import { ZodError } from "zod";

import { loginSchema } from "@/lib/auth/contracts";
import { authenticateUser, createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const credentials = loginSchema.parse(await request.json());
    const user = await authenticateUser(credentials.email, credentials.password);

    if (!user) {
      return Response.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }

    await createSession(user.id);
    return Response.json({ user });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json(
        { error: "Enter a valid email address and password." },
        { status: 400 },
      );
    }

    console.error("Unable to authenticate user", error);
    return Response.json(
      { error: "Traceframe could not sign you in. Please try again." },
      { status: 500 },
    );
  }
}
