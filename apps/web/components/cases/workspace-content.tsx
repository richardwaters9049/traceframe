"use client";

import { AnimatePresence, motion } from "motion/react";

import { ArchitectureWorkspace } from "@/components/cases/architecture-workspace";
import { CaseWorkspace } from "@/components/cases/case-workspace";
import { DashboardWorkspace } from "@/components/cases/dashboard-workspace";
import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import type { AuditEventRecord, CaseRecord } from "@/lib/cases/contracts";

export type CaseWorkspaceRecord = { case: CaseRecord; auditEvents: AuditEventRecord[] };

export function WorkspaceContent({ cases, workspaces }: { cases: CaseRecord[]; workspaces: CaseWorkspaceRecord[] }) {
  const { activeView, selectedCaseId } = useWorkspaceUI();
  const selectedWorkspace = workspaces.find((workspace) => workspace.case.id === selectedCaseId);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={`${activeView}-${selectedCaseId ?? ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: "easeOut" }}>
        {activeView === "architecture" ? <ArchitectureWorkspace /> : activeView === "case" && selectedWorkspace ? <CaseWorkspace workspace={selectedWorkspace} /> : <DashboardWorkspace cases={cases} />}
      </motion.div>
    </AnimatePresence>
  );
}
