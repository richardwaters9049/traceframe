"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { NewCaseDrawer } from "@/components/cases/new-case-drawer";

type WorkspaceUIContextValue = {
  activeView: "dashboard" | "architecture" | "case";
  selectedCaseId: string | null;
  isCreatingCase: boolean;
  showDashboard: () => void;
  showArchitecture: () => void;
  openCase: (caseId: string) => void;
  openNewCase: (opener?: HTMLElement) => void;
  closeNewCase: () => void;
};

const WorkspaceUIContext = createContext<WorkspaceUIContextValue | null>(null);

export function WorkspaceUIProvider({ children }: { children: React.ReactNode }) {
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceUIContextValue["activeView"]>("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseOpener, setCaseOpener] = useState<HTMLElement | null>(null);
  const showDashboard = useCallback(() => { setActiveView("dashboard"); setSelectedCaseId(null); }, []);
  const showArchitecture = useCallback(() => { setActiveView("architecture"); setSelectedCaseId(null); }, []);
  const openCase = useCallback((caseId: string) => { setSelectedCaseId(caseId); setActiveView("case"); }, []);
  const openNewCase = useCallback((opener?: HTMLElement) => {
    setCaseOpener(opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    setIsCreatingCase(true);
  }, []);
  const closeNewCase = useCallback(() => setIsCreatingCase(false), []);

  const value = useMemo(
    () => ({ activeView, selectedCaseId, isCreatingCase, showDashboard, showArchitecture, openCase, openNewCase, closeNewCase }),
    [activeView, closeNewCase, isCreatingCase, openCase, openNewCase, selectedCaseId, showArchitecture, showDashboard],
  );

  return (
    <WorkspaceUIContext.Provider value={value}>
      {children}
      <NewCaseDrawer open={isCreatingCase} onClose={closeNewCase} opener={caseOpener} />
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
    <button type="button" onClick={(event) => openNewCase(event.currentTarget)} className={className}>
      {children}
    </button>
  );
}
