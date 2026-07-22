import type { AuthenticatedUser } from "@/lib/auth/session";

export type WorkspaceCapability = "cases:read" | "cases:create" | "sources:create";

const roleCapabilities: Record<string, ReadonlySet<WorkspaceCapability>> = {
  admin: new Set(["cases:read", "cases:create", "sources:create"]),
  analyst: new Set(["cases:read", "cases:create", "sources:create"]),
  reviewer: new Set(["cases:read"]),
};

export function can(user: Pick<AuthenticatedUser, "role">, capability: WorkspaceCapability) {
  return roleCapabilities[user.role]?.has(capability) ?? false;
}
