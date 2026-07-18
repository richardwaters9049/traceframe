import type { Metadata } from "next";

import { CaseShell } from "@/components/cases/case-shell";
import { WorkspaceContent } from "@/components/cases/workspace-content";
import { requireUser } from "@/lib/auth/session";
import { getCaseWorkspace, listCases } from "@/lib/cases/repository";

export const metadata: Metadata = { title: "Dashboard | Traceframe" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const cases = await listCases();
  const workspaces = (await Promise.all(cases.map((record) => getCaseWorkspace(record.id)))).filter((workspace) => workspace !== null);

  return (
    <CaseShell>
      <WorkspaceContent cases={cases} workspaces={workspaces} />
    </CaseShell>
  );
}
