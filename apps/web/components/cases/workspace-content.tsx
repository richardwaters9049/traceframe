"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ArchitectureWorkspace } from "@/components/cases/architecture-workspace";
import { CaseWorkspace } from "@/components/cases/case-workspace";
import { DashboardWorkspace } from "@/components/cases/dashboard-workspace";
import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import type { AuditVerification } from "@/lib/audit/verify";
import type { AuditEventRecord, CaseCursorPage, CaseRecord } from "@/lib/cases/contracts";
import { apiRequest } from "@/lib/http/client";
import type { SourceRecord } from "@/lib/sources/contracts";

export type CaseWorkspaceRecord = {
  case: CaseRecord;
  auditEvents: AuditEventRecord[];
  verification: AuditVerification;
  sources: SourceRecord[];
};

export function WorkspaceContent({ initialPage, verification }: { initialPage: CaseCursorPage; verification: AuditVerification }) {
  const { activeView, selectedCaseId, showDashboard } = useWorkspaceUI();
  const [workspaceState, setWorkspaceState] = useState<{
    caseId: string;
    workspace: CaseWorkspaceRecord | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (activeView !== "case" || !selectedCaseId) return;
    const controller = new AbortController();
    void apiRequest<{ workspace: CaseWorkspaceRecord }>(`/api/cases/${encodeURIComponent(selectedCaseId)}`, { signal: controller.signal })
      .then((result) => {
        if (result.ok) setWorkspaceState({ caseId: selectedCaseId, workspace: result.data.workspace, error: null });
        else if (result.status !== 0 || !controller.signal.aborted) setWorkspaceState({ caseId: selectedCaseId, workspace: null, error: result.error });
      });
    return () => controller.abort();
  }, [activeView, selectedCaseId]);

  let content = <DashboardWorkspace initialPage={initialPage} verification={verification} />;
  if (activeView === "architecture") content = <ArchitectureWorkspace />;
  if (activeView === "case") {
    const workspace = workspaceState?.caseId === selectedCaseId ? workspaceState.workspace : null;
    const workspaceError = workspaceState?.caseId === selectedCaseId ? workspaceState.error : null;
    if (workspace) content = <CaseWorkspace workspace={workspace} />;
    else content = (
      <section className="grid min-h-[calc(var(--workspace-height)-4rem)] place-items-center px-5 py-8">
        <div className="max-w-md rounded-3xl border border-white/[0.08] bg-navigation p-8 text-center">
          <p className="ui-section-title">{workspaceError ? "Workspace unavailable" : "Loading case workspace…"}</p>
          {workspaceError ? <><p role="alert" className="ui-meta mt-3 text-[#C0C7D2]">{workspaceError}</p><button type="button" onClick={showDashboard} className="ui-label mt-5 rounded-xl bg-primary px-4 py-2.5 text-background">Back to dashboard</button></> : null}
        </div>
      </section>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={`${activeView}-${selectedCaseId ?? ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: "easeOut" }}>
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
