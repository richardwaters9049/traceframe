import { WorkspaceFrame } from "@/components/cases/workspace-frame";
import { WorkspaceUIProvider } from "@/components/cases/workspace-ui-provider";
import { requireUser } from "@/lib/auth/session";

export async function CaseShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <WorkspaceUIProvider>
      <WorkspaceFrame displayName={user.displayName} role={user.role}>
        {children}
      </WorkspaceFrame>
    </WorkspaceUIProvider>
  );
}
