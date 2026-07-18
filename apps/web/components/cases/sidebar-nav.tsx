"use client";

import { AnimatePresence, motion } from "motion/react";
import { FolderKanban, Network, Plus } from "lucide-react";

import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const { activeView, isCreatingCase, openNewCase, showArchitecture, showDashboard } = useWorkspaceUI();
  const items = [
    { label: "Dashboard", icon: FolderKanban, active: activeView === "dashboard" && !isCreatingCase, action: showDashboard },
    { label: "New case", icon: Plus, active: isCreatingCase, action: openNewCase },
    { label: "Architecture", icon: Network, active: activeView === "architecture", action: showArchitecture },
  ];

  return (
    <nav aria-label="Primary navigation" className="space-y-1">
      {items.map(({ label, icon: Icon, active, action }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          title={collapsed ? label : undefined}
          className={`relative flex h-11 w-full items-center rounded-xl text-base tracking-[0.025em] transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "text-white" : "text-[#8991A2] hover:bg-white/[0.045] hover:text-[#E8EBF2]"}`}
        >
          {active ? (
            <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-xl bg-[#7C8DFF]/14 ring-1 ring-inset ring-[#7C8DFF]/20" transition={{ type: "spring", duration: 0.45, bounce: 0.15 }} />
          ) : null}
          <Icon className={`relative size-[18px] ${active ? "text-[#8FA0FF]" : ""}`} aria-hidden="true" />
          <AnimatePresence initial={false}>
            {!collapsed ? <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="relative">{label}</motion.span> : null}
          </AnimatePresence>
        </button>
      ))}
    </nav>
  );
}
