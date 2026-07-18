"use client";

import { ArrowUpRight, FolderOpen } from "lucide-react";
import { motion } from "motion/react";

import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import type { CaseRecord } from "@/lib/cases/contracts";

const priorityStyles: Record<string, string> = {
  standard: "bg-white/[0.055] text-[#A5ADBC] ring-white/[0.08]",
  high: "bg-amber-300/[0.08] text-amber-200 ring-amber-300/15",
  critical: "bg-red-300/[0.08] text-red-200 ring-red-300/15",
};

export function CaseRegister({ cases }: { cases: CaseRecord[] }) {
  const { openCase } = useWorkspaceUI();
  return (
    <motion.section initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.18 }} className="flex min-h-[26rem] min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-[#10131A] shadow-2xl shadow-black/10">
      <div className="grid gap-1 border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <h2 className="ui-section-title">Active register</h2>
        <p className="ui-meta text-[#B6BECA]">Select a record to open its investigation workspace.</p>
      </div>

      {cases.length ? (
        <div className="min-w-0 flex-1">
          <div className="ui-label hidden grid-cols-[3.5rem_minmax(0,1fr)_7rem_7rem] border-b border-white/[0.06] px-6 py-3 uppercase tracking-[0.12em] text-[#747D8E] md:grid">
            <span>No.</span>
            <span>Case</span>
            <span>Opened</span>
            <span className="text-right">Priority</span>
          </div>

          {cases.map((caseRecord, index) => (
            <motion.button
              key={caseRecord.id}
              type="button"
              onClick={() => openCase(caseRecord.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + index * 0.07, duration: 0.35 }}
              whileHover={{ x: 3 }}
              className="group grid w-full min-w-0 gap-3 border-b border-white/[0.055] px-5 py-5 text-left transition-colors last:border-b-0 hover:bg-[#7C8DFF]/[0.055] md:grid-cols-[3.5rem_minmax(0,1fr)_7rem_7rem] md:items-center md:px-6"
            >
              <span className="ui-meta hidden font-mono text-[#687284] md:block">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="ui-section-title min-w-0 truncate text-[#E9ECF2]">
                    {caseRecord.title}
                  </h3>
                  <ArrowUpRight className="size-4 shrink-0 text-[#7A8496] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </div>
                <p className="ui-meta mt-1 line-clamp-2 break-words text-[#ADB6C5] md:line-clamp-1">
                  {caseRecord.summary || "No initial context recorded."}
                </p>
              </div>
              <time dateTime={caseRecord.createdAt} className="ui-meta text-[#C0C7D2]">
                {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(caseRecord.createdAt))}
              </time>
              <span className={`ui-label w-fit rounded-full px-2.5 py-1 uppercase tracking-[0.08em] ring-1 ring-inset md:justify-self-end ${priorityStyles[caseRecord.priority] ?? priorityStyles.standard}`}>
                {caseRecord.priority}
              </span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <FolderOpen className="mx-auto size-7 text-[#738095]" aria-hidden="true" />
            <h3 className="ui-section-title mt-4">No cases yet</h3>
            <p className="ui-meta mt-2 text-[#8791A3]">Create a record to begin.</p>
          </div>
        </div>
      )}
    </motion.section>
  );
}
