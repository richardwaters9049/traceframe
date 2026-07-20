"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, Search, ShieldCheck, Triangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";

import { BrandMark } from "@/components/brand/brand-mark";
import { SidebarNav } from "@/components/cases/sidebar-nav";
import { NewCaseButton } from "@/components/cases/workspace-ui-provider";
import { apiRequest } from "@/lib/http/client";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function WorkspaceFrame({
  children,
  displayName,
  role,
}: {
  children: React.ReactNode;
  displayName: string;
  role: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSignOutPending, setIsSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [scrollNavigation, setScrollNavigation] = useState({ isScrollable: false, isAtBottom: false });

  useEffect(() => {
    function updateScrollNavigation() {
      const maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const nextState = {
        isScrollable: maximumScroll > 16,
        isAtBottom: maximumScroll > 0 && window.scrollY >= maximumScroll - 12,
      };
      setScrollNavigation((currentState) =>
        currentState.isScrollable === nextState.isScrollable && currentState.isAtBottom === nextState.isAtBottom
          ? currentState
          : nextState,
      );
    }

    const initialFrame = window.requestAnimationFrame(updateScrollNavigation);
    const resizeObserver = new ResizeObserver(updateScrollNavigation);
    resizeObserver.observe(document.body);
    window.addEventListener("scroll", updateScrollNavigation, { passive: true });
    window.addEventListener("resize", updateScrollNavigation);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateScrollNavigation);
      window.removeEventListener("resize", updateScrollNavigation);
    };
  }, []);

  function moveThroughPage() {
    window.scrollTo({
      top: scrollNavigation.isAtBottom ? 0 : document.documentElement.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  async function signOut() {
    if (isSignOutPending || isSigningOut) return;
    setIsSignOutPending(true);
    setSignOutError(null);
    const result = await apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" });
    setIsSignOutPending(false);
    if (!result.ok) {
      setSignOutError(result.error);
      return;
    }
    setIsSigningOut(true);
    await new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 80 : 1250));
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="workspace-canvas min-h-screen overflow-x-clip bg-background text-foreground">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.992 }}
        animate={{
          opacity: 1,
          scale: 1,
          gridTemplateColumns: isSidebarOpen
            ? "16.5rem minmax(0, 1fr)"
            : "5.25rem minmax(0, 1fr)",
        }}
        transition={{
          opacity: { duration: 0.45 },
          scale: { duration: 0.45 },
          gridTemplateColumns: { type: "spring", stiffness: 280, damping: 31 },
        }}
        className="lg:grid lg:min-h-[var(--workspace-height)]"
      >
        <aside className="sticky top-0 z-20 hidden h-[var(--workspace-height)] self-start p-3 pr-0 lg:block">
          <div className="flex h-[calc(var(--workspace-height)-1.5rem)] flex-col overflow-hidden rounded-[1.45rem] border border-white/[0.07] bg-navigation p-3 shadow-2xl shadow-black/20">
            <div className="pointer-events-none absolute -right-20 -top-20 size-48 rounded-full border-[30px] border-[#7C8DFF]/[0.055]" />
            <div className={`relative flex h-[8.5rem] flex-col justify-center py-2 ${isSidebarOpen ? "gap-3 px-2" : "items-center gap-2"}`}>
              <Link href="/dashboard" className="min-w-0 overflow-hidden" aria-label="Traceframe dashboard">
                <BrandMark size={isSidebarOpen ? "large" : "compact"} showWordmark={isSidebarOpen} />
              </Link>
              <button
                type="button"
                onClick={() => setIsSidebarOpen((open) => !open)}
                className={`flex shrink-0 items-center rounded-xl border border-white/[0.08] bg-black/10 text-[#C5CCD7] transition-colors hover:border-[#7C8DFF]/30 hover:bg-primary/10 hover:text-white ${isSidebarOpen ? "h-10 w-full justify-between px-3 text-sm font-medium tracking-[0.035em]" : "size-10 justify-center"}`}
                aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                aria-pressed={!isSidebarOpen}
                title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {isSidebarOpen ? <><span>Collapse sidebar</span><ChevronsLeft className="size-4" /></> : <ChevronsRight className="size-5" />}
              </button>
            </div>

            <div className="relative mt-6 flex-1">
              <motion.p
                initial={false}
                animate={{ opacity: isSidebarOpen ? 1 : 0, x: isSidebarOpen ? 0 : -8 }}
                transition={{ duration: 0.18 }}
                aria-hidden={!isSidebarOpen}
                className="ui-eyebrow mb-3 whitespace-nowrap px-3 text-[#9BA5B6]"
              >
                Workspace
              </motion.p>
              <SidebarNav collapsed={!isSidebarOpen} />
            </div>

            <motion.div
              layout
              className={`relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.045] to-white/[0.018] ${isSidebarOpen ? "p-3" : "p-2"}`}
            >
              {isSidebarOpen ? (
                <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                  <span className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-[#7C8DFF]/15 bg-primary/15 text-[0.95rem] font-semibold tracking-[0.02em] text-[#B6BEFF]">
                    {initials(displayName)}
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#141820] bg-[#58D6C7]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 overflow-hidden">
                    <p className="truncate text-base font-medium tracking-[0.025em] text-foreground" title={displayName}>{displayName}</p>
                    <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.13em] text-[#A4ADBC]">{role}</p>
                  </div>
                  <button type="button" data-testid="sign-out-desktop" onClick={signOut} disabled={isSigningOut || isSignOutPending} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-black/10 text-[#AAB3C2] transition-colors hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white" aria-label="Sign out" title="Sign out">
                    <LogOut className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="grid justify-items-center gap-2">
                  <span className="relative grid size-10 place-items-center rounded-xl bg-primary/15 text-sm font-semibold text-[#B6BEFF]">
                    {initials(displayName)}
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#141820] bg-[#58D6C7]" />
                  </span>
                  <button type="button" data-testid="sign-out-desktop" onClick={signOut} disabled={isSigningOut || isSignOutPending} className="grid size-9 place-items-center rounded-xl text-[#AAB3C2] transition-colors hover:bg-white/[0.08] hover:text-white" aria-label="Sign out" title="Sign out">
                    <LogOut className="size-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </aside>

        <motion.section layout className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5 sm:px-7 lg:px-8">
            <Link href="/dashboard" className="lg:hidden" aria-label="Traceframe dashboard"><BrandMark /></Link>
            <div className="ui-meta hidden items-center gap-2 text-[#A5AEBE] lg:flex">
              <Search className="size-5" aria-hidden="true" />
              <span>Secure case workspace</span>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <button type="button" onClick={() => setIsMobileSidebarOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-sm font-medium text-[#DCE1E8] transition-colors hover:bg-white/[0.08] hover:text-white" aria-label="Open sidebar">
                <Menu className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Menu</span>
              </button>
              <NewCaseButton className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-[#080A0F]">New</NewCaseButton>
            </div>
            <span className="ui-eyebrow hidden rounded-full border border-[#58D6C7]/20 bg-[#58D6C7]/[0.07] px-3 py-1.5 text-[#89EADD] sm:inline-flex">Encrypted session</span>
          </header>
          <div className="min-h-[calc(var(--workspace-height)-4rem)]">{children}</div>
        </motion.section>
      </motion.div>

      <Dialog.Root open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <Dialog.Portal>
            <Dialog.Backdrop
              className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 lg:hidden"
            />
            <Dialog.Popup
              className="fixed inset-y-0 left-0 z-[70] flex w-[min(21rem,calc(100vw-1rem))] flex-col overflow-hidden border-r border-white/[0.08] bg-navigation p-4 shadow-[35px_0_90px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-300 ease-out data-ending-style:-translate-x-full data-ending-style:opacity-70 data-starting-style:-translate-x-full data-starting-style:opacity-70 lg:hidden"
              aria-labelledby="mobile-navigation-title"
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <Link href="/dashboard" onClick={() => setIsMobileSidebarOpen(false)} aria-label="Traceframe dashboard">
                  <BrandMark size="large" />
                </Link>
                <Dialog.Close className="grid size-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-[#C9D0DA] transition-colors hover:bg-white/[0.08] hover:text-white" aria-label="Close sidebar">
                  <X className="size-5" aria-hidden="true" />
                </Dialog.Close>
              </div>

              <div className="mt-7 flex-1">
                <Dialog.Title id="mobile-navigation-title" className="ui-eyebrow mb-3 px-3 text-[#A4ADBC]">Workspace navigation</Dialog.Title>
                <div onClickCapture={(event) => {
                  const interactiveTarget = (event.target as HTMLElement).closest("a, button");
                  if (interactiveTarget) setIsMobileSidebarOpen(false);
                }}>
                  <SidebarNav />
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-3">
                <span className="relative grid size-11 place-items-center rounded-xl border border-[#7C8DFF]/15 bg-primary/15 text-sm font-semibold text-[#B6BEFF]">
                  {initials(displayName)}
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#141820] bg-[#58D6C7]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">{displayName}</p>
                  <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.13em] text-[#A4ADBC]">{role}</p>
                </div>
                <button type="button" data-testid="sign-out-mobile" onClick={signOut} disabled={isSigningOut || isSignOutPending} className="grid size-11 place-items-center rounded-xl border border-white/[0.07] text-[#B5BECA] transition-colors hover:bg-white/[0.08] hover:text-white" aria-label="Sign out">
                  <LogOut className="size-4" aria-hidden="true" />
                </button>
              </div>
            </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {signOutError ? (
        <div role="alert" className="fixed bottom-5 left-1/2 z-[90] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-red-300/20 bg-[#171016]/95 px-5 py-4 text-center text-sm text-red-100 shadow-2xl">
          {signOutError}
        </div>
      ) : null}

      <AnimatePresence>
        {scrollNavigation.isScrollable ? (
          <motion.button
            type="button"
            onClick={moveThroughPage}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            whileHover={{ y: scrollNavigation.isAtBottom ? -3 : 3 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-2xl border border-[#7C8DFF]/25 bg-[#111620]/95 text-[#AAB4FF] shadow-[0_12px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl hover:border-[#7C8DFF]/45 hover:bg-[#171D2A] hover:text-white"
            aria-label={scrollNavigation.isAtBottom ? "Scroll to top" : "Scroll to more content"}
            title={scrollNavigation.isAtBottom ? "Back to top" : "More content below"}
          >
            <motion.span animate={{ rotate: scrollNavigation.isAtBottom ? 0 : 180 }} transition={{ type: "spring", stiffness: 280, damping: 22 }}>
              <Triangle className="size-5 fill-current" aria-hidden="true" />
            </motion.span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isSigningOut ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-background/95 backdrop-blur-xl"
          >
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 22 }} className="relative grid justify-items-center">
              <motion.span animate={reduceMotion ? {} : { rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }} transition={{ duration: 0.7 }} className="grid size-20 place-items-center rounded-[1.6rem] border border-[#58D6C7]/20 bg-[#58D6C7]/10 text-[#79E5D8] shadow-[0_0_70px_rgba(88,214,199,0.15)]">
                <ShieldCheck className="size-9" />
              </motion.span>
              <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-6 text-2xl font-medium tracking-[0.035em]">Session secured</motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }} className="mt-2 text-base text-[#C4CBD6]">Goodbye, {displayName}.</motion.p>
              <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.75, ease: "easeInOut" }} className="mt-6 h-px w-48 bg-gradient-to-r from-transparent via-[#7C8DFF] to-transparent" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
