import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { createCaseSchema } from "@/lib/cases/contracts";
import { createCase, listCases } from "@/lib/cases/repository";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const cases = await listCases();
  return Response.json({ cases });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const input = createCaseSchema.parse(await request.json());
    const createdCase = await createCase(input, user.email);

    return Response.json({ case: createdCase }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: "The case details are invalid.",
          issues: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: "The request body is not valid JSON." }, { status: 400 });
    }

    console.error("Unable to create case", error);
    return Response.json(
      { error: "The case could not be created. Please try again." },
      { status: 500 },
    );
  }
}
