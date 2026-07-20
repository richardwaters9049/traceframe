import type { Metadata } from "next";

import { CaseShell } from "@/components/cases/case-shell";
import { WorkspaceContent } from "@/components/cases/workspace-content";
import { requireUser } from "@/lib/auth/session";
import { CASE_REGISTER_PAGE_SIZE } from "@/lib/cases/contracts";
import { listCasePage, verifyGlobalAuditLedger } from "@/lib/cases/repository";

export const metadata: Metadata = { title: "Dashboard | Traceframe" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const [casePage, verification] = await Promise.all([
    listCasePage(null, CASE_REGISTER_PAGE_SIZE),
    verifyGlobalAuditLedger(),
  ]);

  return (
    <CaseShell>
      <WorkspaceContent initialPage={casePage} verification={verification} />
    </CaseShell>
  );
}
