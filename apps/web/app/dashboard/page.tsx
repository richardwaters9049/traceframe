import type { Metadata } from "next";

import { CaseShell } from "@/components/cases/case-shell";
import { WorkspaceContent } from "@/components/cases/workspace-content";
import { requireUser } from "@/lib/auth/session";
import { listCasePage, verifyGlobalAuditLedger } from "@/lib/cases/repository";

export const metadata: Metadata = { title: "Dashboard | Traceframe" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const [casePage, verification] = await Promise.all([
    listCasePage(),
    verifyGlobalAuditLedger(),
  ]);

  return (
    <CaseShell>
      <WorkspaceContent initialPage={casePage} verification={verification} />
    </CaseShell>
  );
}
