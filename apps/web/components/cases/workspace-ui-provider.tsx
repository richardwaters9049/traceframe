"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence } from "motion/react";

import { NewCaseDrawer } from "@/components/cases/new-case-drawer";

type WorkspaceUIContextValue = {
  activeView: "dashboard" | "architecture" | "case";
  selectedCaseId: string | null;
  isCreatingCase: boolean;
  showDashboard: () => void;
  showArchitecture: () => void;
  openCase: (caseId: string) => void;
  openNewCase: () => void;
  closeNewCase: () => void;
};

const WorkspaceUIContext = createContext<WorkspaceUIContextValue | null>(null);

export function WorkspaceUIProvider({ children }: { children: React.ReactNode }) {
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceUIContextValue["activeView"]>("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const showDashboard = useCallback(() => { setActiveView("dashboard"); setSelectedCaseId(null); }, []);
  const showArchitecture = useCallback(() => { setActiveView("architecture"); setSelectedCaseId(null); }, []);
  const openCase = useCallback((caseId: string) => { setSelectedCaseId(caseId); setActiveView("case"); }, []);
  const openNewCase = useCallback(() => setIsCreatingCase(true), []);
  const closeNewCase = useCallback(() => setIsCreatingCase(false), []);

  useEffect(() => {
    document.body.style.overflow = isCreatingCase ? "hidden" : "";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeNewCase();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeNewCase, isCreatingCase]);

  const value = useMemo(
    () => ({ activeView, selectedCaseId, isCreatingCase, showDashboard, showArchitecture, openCase, openNewCase, closeNewCase }),
    [activeView, closeNewCase, isCreatingCase, openCase, openNewCase, selectedCaseId, showArchitecture, showDashboard],
  );

  return (
    <WorkspaceUIContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {isCreatingCase ? <NewCaseDrawer onClose={closeNewCase} /> : null}
      </AnimatePresence>
    </WorkspaceUIContext.Provider>
  );
}

export function useWorkspaceUI() {
  const context = useContext(WorkspaceUIContext);
  if (!context) throw new Error("useWorkspaceUI must be used within WorkspaceUIProvider");
  return context;
}

export function NewCaseButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { openNewCase } = useWorkspaceUI();

  return (
    <button type="button" onClick={openNewCase} className={className}>
      {children}
    </button>
  );
}
