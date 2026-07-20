"use client";

import { ArrowUpRight, FolderOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CASE_REGISTER_PAGE_SIZE, type CaseCursorPage } from "@/lib/cases/contracts";
import { apiRequest } from "@/lib/http/client";

const priorityStyles: Record<string, string> = {
  standard: "bg-white/[0.055] text-[#A5ADBC] ring-white/[0.08]",
  high: "bg-amber-300/[0.08] text-amber-200 ring-amber-300/15",
  critical: "bg-red-300/[0.08] text-red-200 ring-red-300/15",
};

export function CaseRegister({ initialPage }: { initialPage: CaseCursorPage }) {
  const { openCase } = useWorkspaceUI();
  const [pages, setPages] = useState([initialPage]);
  const [pageIndex, setPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = pages[pageIndex];
  const totalPages = Math.max(1, Math.ceil(initialPage.totalCount / CASE_REGISTER_PAGE_SIZE));
  const firstRecord = pageIndex * CASE_REGISTER_PAGE_SIZE + 1;
  const lastRecord = Math.min(firstRecord + page.cases.length - 1, initialPage.totalCount);

  function showPreviousPage() {
    if (pageIndex === 0 || isLoading) return;
    setError(null);
    setPageIndex((current) => current - 1);
  }

  async function showNextPage() {
    if (isLoading) return;
    if (pages[pageIndex + 1]) {
      setError(null);
      setPageIndex((current) => current + 1);
      return;
    }
    if (!page.nextCursor) return;

    setIsLoading(true);
    setError(null);
    const result = await apiRequest<CaseCursorPage>(
      `/api/cases?limit=${CASE_REGISTER_PAGE_SIZE}&cursor=${encodeURIComponent(page.nextCursor)}`,
    );
    if (result.ok) {
      setPages((current) => [...current, result.data]);
      setPageIndex((current) => current + 1);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }

  function showLoadedPage(targetPageIndex: number) {
    if (isLoading || !pages[targetPageIndex]) return;
    setError(null);
    setPageIndex(targetPageIndex);
  }

  const hasPreviousPage = pageIndex > 0;
  const hasNextPage = Boolean(pages[pageIndex + 1] || page.nextCursor);

  return (
    <motion.section
      id="active-register"
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: 0.18 }}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-navigation shadow-2xl shadow-black/10"
    >
      <div className="flex min-w-0 items-end justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="ui-section-title">Active register</h2>
          <p className="ui-meta truncate text-[#B6BECA]">Select a record to open its investigation workspace.</p>
        </div>
        {initialPage.totalCount ? (
          <p className="ui-label hidden shrink-0 text-[#8D97A8] sm:block">
            {firstRecord}–{lastRecord} of {initialPage.totalCount}
          </p>
        ) : null}
      </div>

      {page.cases.length ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="ui-label hidden shrink-0 grid-cols-[3.5rem_minmax(0,1fr)_7rem_7rem] border-b border-white/[0.06] px-6 py-2.5 uppercase tracking-[0.12em] text-[#8791A3] md:grid">
            <span>No.</span>
            <span>Case</span>
            <span>Opened</span>
            <span className="text-right">Priority</span>
          </div>

          <div className="relative min-h-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pageIndex}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="grid h-full grid-rows-5"
              >
                {page.cases.map((caseRecord, index) => (
                  <motion.button
                    key={caseRecord.id}
                    data-testid="case-row"
                    type="button"
                    onClick={() => openCase(caseRecord.id)}
                    initial={{ opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.035, duration: 0.24 }}
                    whileHover={{ x: 3 }}
                    className="group grid min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-white/[0.055] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-primary/[0.055] focus-visible:z-10 sm:px-5 md:grid-cols-[3.5rem_minmax(0,1fr)_7rem_7rem] md:gap-2 md:px-6"
                  >
                    <span className="ui-meta hidden font-mono text-[#8A94A6] md:block">
                      {String(firstRecord + index).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-base font-medium leading-6 tracking-[0.025em] text-[#E9ECF2] sm:text-lg sm:leading-7">
                          {caseRecord.title}
                        </h3>
                        <ArrowUpRight className="size-4 shrink-0 text-[#7A8496] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                      </div>
                      <p className="truncate text-[0.82rem] leading-5 tracking-[0.03em] text-[#ADB6C5] sm:text-sm sm:leading-6">
                        {caseRecord.summary || "No initial context recorded."}
                      </p>
                    </div>
                    <time dateTime={caseRecord.createdAt} className="col-start-2 row-start-1 justify-self-end text-sm leading-6 tracking-[0.03em] text-[#C0C7D2] md:col-auto md:row-auto md:justify-self-auto md:text-base md:leading-7">
                      {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(caseRecord.createdAt))}
                    </time>
                    <span className={`col-start-2 row-start-2 w-fit justify-self-end rounded-full px-2 py-0.5 text-[0.72rem] font-medium uppercase leading-5 tracking-[0.08em] ring-1 ring-inset md:col-auto md:row-auto md:px-2.5 md:py-1 md:text-[0.95rem] md:leading-6 ${priorityStyles[caseRecord.priority] ?? priorityStyles.standard}`}>
                      {caseRecord.priority}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="grid min-h-[4.35rem] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-white/[0.06] bg-black/[0.08] px-4 py-2.5 sm:px-5">
            <p className="ui-label hidden text-[#8D97A8] sm:block" aria-live="polite">
              Page {pageIndex + 1} of {totalPages}
            </p>
            <Pagination className="col-start-2" aria-label="Case register pages">
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <PaginationPrevious
                    href="#active-register"
                    text="Previous"
                    aria-disabled={!hasPreviousPage || isLoading}
                    tabIndex={!hasPreviousPage || isLoading ? -1 : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      showPreviousPage();
                    }}
                    className={`h-9 rounded-xl border border-transparent px-2.5 text-[#AAB3C2] hover:border-white/[0.09] hover:bg-white/[0.06] hover:text-white ${!hasPreviousPage || isLoading ? "pointer-events-none opacity-35" : ""}`}
                  />
                </PaginationItem>

                {pageIndex > 1 ? (
                  <>
                    <PaginationItem className="hidden sm:block">
                      <PaginationLink
                        href="#active-register"
                        aria-label="Go to page 1"
                        onClick={(event) => {
                          event.preventDefault();
                          showLoadedPage(0);
                        }}
                        className="size-9 rounded-xl border-transparent text-[#AAB3C2] hover:bg-white/[0.06] hover:text-white"
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    {pageIndex > 2 ? <PaginationItem className="hidden sm:block"><PaginationEllipsis className="text-[#727D90]" /></PaginationItem> : null}
                  </>
                ) : null}

                {hasPreviousPage ? (
                  <PaginationItem className="hidden sm:block">
                    <PaginationLink
                      href="#active-register"
                      aria-label={`Go to page ${pageIndex}`}
                      onClick={(event) => {
                        event.preventDefault();
                        showLoadedPage(pageIndex - 1);
                      }}
                      className="size-9 rounded-xl border-transparent text-[#AAB3C2] hover:bg-white/[0.06] hover:text-white"
                    >
                      {pageIndex}
                    </PaginationLink>
                  </PaginationItem>
                ) : null}

                <PaginationItem>
                  <PaginationLink
                    href="#active-register"
                    isActive
                    aria-label={`Page ${pageIndex + 1}`}
                    onClick={(event) => event.preventDefault()}
                    className="size-9 rounded-xl border-primary/30 bg-primary/12 text-[#C4CBFF] shadow-[0_0_24px_rgba(124,141,255,0.08)]"
                  >
                    {pageIndex + 1}
                  </PaginationLink>
                </PaginationItem>

                {hasNextPage ? (
                  <PaginationItem className="hidden sm:block">
                    <PaginationLink
                      href="#active-register"
                      aria-label={`Go to page ${pageIndex + 2}`}
                      onClick={(event) => {
                        event.preventDefault();
                        void showNextPage();
                      }}
                      className="size-9 rounded-xl border-transparent text-[#AAB3C2] hover:bg-white/[0.06] hover:text-white"
                    >
                      {pageIndex + 2}
                    </PaginationLink>
                  </PaginationItem>
                ) : null}

                {pageIndex + 2 < totalPages ? <PaginationItem className="hidden sm:block"><PaginationEllipsis className="text-[#727D90]" /></PaginationItem> : null}

                <PaginationItem>
                  <PaginationNext
                    href="#active-register"
                    text={isLoading ? "Loading" : "Next"}
                    aria-disabled={!hasNextPage || isLoading}
                    tabIndex={!hasNextPage || isLoading ? -1 : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      void showNextPage();
                    }}
                    className={`h-9 rounded-xl border border-transparent px-2.5 text-[#AAB3C2] hover:border-white/[0.09] hover:bg-white/[0.06] hover:text-white ${!hasNextPage || isLoading ? "pointer-events-none opacity-35" : ""}`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <div className="min-w-0 justify-self-end">
              <p className="ui-label sm:hidden text-[#8D97A8]" aria-live="polite">{pageIndex + 1} / {totalPages}</p>
              <p role="alert" className="ui-label hidden max-w-48 truncate text-red-200 sm:block" title={error ?? undefined}>{error}</p>
            </div>
          </div>
          {error ? <p role="alert" className="ui-label px-5 pb-3 text-center text-red-200 sm:hidden">{error}</p> : null}
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
