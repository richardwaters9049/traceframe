"use client";

import { CheckCircle2, CircleAlert, FolderKanban, Plus } from "lucide-react";
import { motion } from "motion/react";

import { CaseRegister } from "@/components/cases/case-register";
import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import type { CaseCursorPage } from "@/lib/cases/contracts";
import type { AuditVerification } from "@/lib/audit/verify";

export function DashboardWorkspace({ initialPage, verification }: { initialPage: CaseCursorPage; verification: AuditVerification }) {
  const { openNewCase } = useWorkspaceUI();
  const { totalCount, urgentCount } = initialPage;
  const verificationCopy = verification.status === "verified"
    ? { title: "Chain verified", detail: `${verification.checkedEvents} linked ${verification.checkedEvents === 1 ? "event" : "events"} checked.` }
    : verification.status === "broken"
      ? { title: "Chain integrity failed", detail: "Audit history needs investigation." }
      : { title: "Verification unavailable", detail: "Audit status could not be checked." };

  return (
    <>
      <motion.section
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.12 } } }}
        className="grid min-h-[calc(var(--workspace-height)-4rem)] min-w-0 grid-rows-[auto_1fr] gap-5 px-5 py-6 sm:px-7 lg:px-8 lg:py-7"
      >
        <motion.header variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.45, ease: "easeOut" }} className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <p className="ui-eyebrow text-[#8794FF]">Investigation overview</p>
            <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="ui-page-title">Dashboard</h1>
              <span className="ui-meta text-[#8A94A6]">{totalCount} active {totalCount === 1 ? "case" : "cases"}</span>
            </div>
          </div>
          <button
            type="button"
            data-testid="new-case-primary"
            onClick={(event) => openNewCase(event.currentTarget)}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold tracking-[0.03em] text-background transition-colors hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" />
            New case
          </button>
        </motion.header>

        <motion.div variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.5, ease: "easeOut" }} className="grid min-h-0 min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <CaseRegister initialPage={initialPage} />

          <aside className="grid min-w-0 auto-rows-fr gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
            <motion.div whileHover={{ y: -3, borderColor: "rgba(124,141,255,0.22)" }} transition={{ type: "spring", stiffness: 320, damping: 24 }} className="flex min-h-0 min-w-0 flex-col justify-evenly rounded-[1.35rem] border border-white/[0.07] bg-navigation p-5">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-[#A8B3FF]">
                <FolderKanban className="size-7" aria-hidden="true" />
              </span>
              <p className="min-w-0 pl-[13px] pt-[10px] text-3xl font-medium tracking-[-0.02em]">{totalCount}</p>
              <p className="ui-meta min-w-0 pl-[13px] pt-[10px] text-[#C0C7D2]">Open records</p>
            </motion.div>

            <motion.div whileHover={{ y: -3, borderColor: "rgba(253,224,71,0.18)" }} transition={{ type: "spring", stiffness: 320, damping: 24 }} className="flex min-h-0 min-w-0 flex-col justify-evenly rounded-[1.35rem] border border-white/[0.07] bg-navigation p-5">
              <span className="grid size-14 place-items-center rounded-2xl bg-amber-300/[0.09] text-amber-200">
                <CircleAlert className="size-7" aria-hidden="true" />
              </span>
              <p className="min-w-0 pl-[13px] pt-[10px] text-3xl font-medium tracking-[-0.02em]">{urgentCount}</p>
              <p className="ui-meta min-w-0 pl-[13px] pt-[10px] text-[#C0C7D2]">Priority reviews</p>
            </motion.div>

            <motion.div whileHover={{ y: -3, borderColor: "rgba(88,214,199,0.25)" }} transition={{ type: "spring", stiffness: 320, damping: 24 }} className="flex min-h-0 min-w-0 flex-col justify-evenly rounded-[1.35rem] border border-[#58D6C7]/12 bg-[#58D6C7]/[0.035] p-5">
              <span className="grid size-14 place-items-center rounded-2xl bg-[#58D6C7]/12 text-[#7BE5D8]">
                <CheckCircle2 className="size-7" aria-hidden="true" />
              </span>
              <p className="ui-section-title min-w-0 pl-[13px] pt-[10px] text-[#F0F4F7]">{verificationCopy.title}</p>
              <p className="ui-meta min-w-0 break-words pl-[13px] pt-[10px] text-[#C0C9D3]">{verificationCopy.detail}</p>
            </motion.div>
          </aside>
        </motion.div>
      </motion.section>

    </>
  );
}
