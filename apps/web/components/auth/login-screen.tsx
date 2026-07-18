"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ScanLine } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginResponse = { error?: string };

function LoadingSequence({ onComplete }: { onComplete: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onComplete, reduceMotion ? 80 : 1750);
    return () => window.clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.025, filter: "blur(8px)" }}
      transition={{ duration: reduceMotion ? 0.01 : 0.45, ease: "easeInOut" }}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#080A0F]"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={reduceMotion ? { opacity: 1 } : { scale: [0.5, 1.05, 1], opacity: [0, 1, 0.65] }}
        transition={{ duration: 1.15, ease: "easeOut" }}
        className="absolute size-[28rem] rounded-full border border-[#7C8DFF]/18 sm:size-[38rem]"
      />
      <motion.div
        initial={{ scale: 0.35, opacity: 0 }}
        animate={reduceMotion ? { opacity: 1 } : { scale: [0.35, 0.86, 0.82], opacity: [0, 0.85, 0.35] }}
        transition={{ duration: 1.15, delay: 0.08, ease: "easeOut" }}
        className="absolute size-[19rem] rounded-full border border-[#58D6C7]/18 sm:size-[27rem]"
      />
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: reduceMotion ? 420 : [0, 680, 520], opacity: [0, 0.55, 0.18] }}
        transition={{ duration: 1.2, delay: 0.15, ease: "easeInOut" }}
        className="absolute h-px bg-[linear-gradient(90deg,transparent,#7C8DFF,#58D6C7,transparent)]"
      />

      {!reduceMotion ? (
        <>
          <motion.span
            initial={{ x: -270, y: -150, opacity: 0, scale: 0.5 }}
            animate={{ x: [-270, -170, -72, 0], y: [-150, 64, -32, 0], opacity: [0, 1, 1, 0], scale: [0.5, 1, 0.8, 0.2] }}
            transition={{ duration: 1.25, delay: 0.12, ease: "easeInOut" }}
            className="absolute size-2.5 rounded-full bg-[#7C8DFF] shadow-[0_0_20px_#7C8DFF]"
          />
          <motion.span
            initial={{ x: 260, y: 138, opacity: 0, scale: 0.5 }}
            animate={{ x: [260, 150, 78, 0], y: [138, -72, 40, 0], opacity: [0, 1, 1, 0], scale: [0.5, 1, 0.8, 0.2] }}
            transition={{ duration: 1.25, delay: 0.2, ease: "easeInOut" }}
            className="absolute size-2 rounded-full bg-[#58D6C7] shadow-[0_0_18px_#58D6C7]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: [0, 0, 0.5, 0], scale: [0.75, 0.75, 1.7, 2] }}
            transition={{ duration: 0.65, delay: 1.03, ease: "easeOut" }}
            className="absolute size-16 rounded-full border border-[#58D6C7]/50"
          />
        </>
      ) : null}

      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
        className="relative flex h-64 w-[22rem] flex-col items-center justify-center rounded-[2.2rem] border border-[#7C8DFF]/25 bg-[#0D1119]/75 shadow-[0_0_100px_rgba(124,141,255,0.12)] backdrop-blur-md"
      >
        <span className="absolute left-0 top-0 size-7 rounded-tl-[2.2rem] border-l-2 border-t-2 border-[#58D6C7]" />
        <span className="absolute right-0 top-0 size-7 rounded-tr-[2.2rem] border-r-2 border-t-2 border-[#58D6C7]" />
        <span className="absolute bottom-0 left-0 size-7 rounded-bl-[2.2rem] border-b-2 border-l-2 border-[#58D6C7]" />
        <span className="absolute bottom-0 right-0 size-7 rounded-br-[2.2rem] border-b-2 border-r-2 border-[#58D6C7]" />
        <BrandMark showWordmark={false} size="hero" />
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.7, duration: 0.35 }}
          className="mt-5 text-base font-semibold uppercase leading-7 tracking-[0.28em] text-[#D7DCE5]"
        >
          Traceframe
        </motion.p>
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.8, duration: 0.65, ease: "easeInOut" }}
          className="mt-4 h-px w-32 origin-center bg-[linear-gradient(90deg,transparent,#7C8DFF,#58D6C7,transparent)]"
        />
        {!reduceMotion ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: [0, 0, 1, 0], y: [4, 4, 0, -2] }}
            transition={{ duration: 0.58, delay: 1.02, ease: "easeOut" }}
            className="ui-meta absolute bottom-5 whitespace-nowrap text-[#69DCCE]"
          >
            Signal acquired
          </motion.p>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

export function LoginScreen({ skipIntro = false }: { skipIntro?: boolean }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnteringWorkspace, setIsEnteringWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skipIntro) document.cookie = "traceframe_skip_intro=; Max-Age=0; Path=/; SameSite=Strict";
  }, [skipIntro]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const result = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setError(result.error ?? "Sign in failed.");
        return;
      }

      setIsEnteringWorkspace(true);
      await new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 60 : 720));
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Traceframe could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {showIntro ? <LoadingSequence onComplete={() => setShowIntro(false)} /> : null}
      </AnimatePresence>

      <motion.main
        initial={false}
        animate={{
          opacity: showIntro || isEnteringWorkspace ? 0 : 1,
          y: showIntro || reduceMotion ? 0 : isEnteringWorkspace ? -12 : [8, 0],
          scale: isEnteringWorkspace && !reduceMotion ? 0.985 : 1,
          filter: isEnteringWorkspace && !reduceMotion ? "blur(6px)" : "blur(0px)",
        }}
        transition={{ duration: skipIntro || reduceMotion ? 0.01 : 0.55, delay: showIntro || skipIntro ? 0 : 0.12 }}
        className="relative flex min-h-screen flex-col overflow-hidden bg-[#080A0F] text-[#F5F7FA]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_36%,rgba(124,141,255,0.13),transparent_25%),radial-gradient(circle_at_78%_66%,rgba(88,214,199,0.07),transparent_24%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] [background-size:80px_80px]" />

        <motion.header initial={skipIntro ? false : { opacity: 0, y: -10 }} animate={showIntro ? {} : { opacity: 1, y: 0 }} transition={{ delay: skipIntro ? 0 : 0.12, duration: skipIntro ? 0 : 0.45 }} className="relative z-10 flex h-28 items-center justify-between px-6 sm:px-10 lg:px-16">
          <BrandMark size="hero" />
          <span className="ui-eyebrow hidden items-center gap-2 text-[#A4ADBC] sm:flex">
            <span className="size-1.5 rounded-full bg-[#58D6C7] shadow-[0_0_12px_#58D6C7]" />
            Secure access
          </span>
        </motion.header>

        <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-start px-6 pb-8 pt-10 sm:px-10 sm:pt-12 lg:px-16 lg:pt-16">
          <div className="grid w-full items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.1fr)]">
            <div className="relative z-10 max-w-2xl">
              <motion.p
                initial={skipIntro ? false : { opacity: 0, x: -10 }}
                animate={showIntro ? {} : { opacity: 1, x: 0 }}
                transition={{ delay: skipIntro ? 0 : 0.22, duration: skipIntro ? 0 : 0.4 }}
                className="ui-feature-eyebrow text-[#A0ABFF]"
              >
                Evidence-led analysis
              </motion.p>
              <motion.h1
                initial={skipIntro ? false : { opacity: 0, y: 18 }}
                animate={showIntro ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: skipIntro ? 0 : 0.28, duration: skipIntro ? 0 : 0.55, ease: "easeOut" }}
                className="mt-4 text-balance text-5xl font-medium leading-[1.04] tracking-[-0.025em] xl:text-6xl"
              >
                Find the signal.
                <span className="block text-[#B1B9C6]">Keep the proof.</span>
              </motion.h1>
              <motion.p
                initial={skipIntro ? false : { opacity: 0, y: 12 }}
                animate={showIntro ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: skipIntro ? 0 : 0.36, duration: skipIntro ? 0 : 0.5, ease: "easeOut" }}
                className="mt-6 max-w-xl text-lg leading-8 tracking-[0.025em] text-[#B8C1CE]"
              >
                Organise investigations, preserve their context, and maintain a verifiable audit trail from first record to final review.
              </motion.p>
            </div>

            <div className="relative hidden min-h-[22rem] place-items-center lg:grid" aria-hidden="true">
              <motion.div
                animate={reduceMotion ? {} : { rotate: 360 }}
                transition={{ duration: 34, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="absolute size-[22rem] rounded-full border border-dashed border-[#7C8DFF]/20"
              >
                <span className="absolute left-1/2 top-[-4px] size-2 -translate-x-1/2 rounded-full bg-[#7C8DFF] shadow-[0_0_18px_#7C8DFF]" />
                <span className="absolute bottom-[12%] right-[10%] size-1.5 rounded-full bg-[#58D6C7] shadow-[0_0_15px_#58D6C7]" />
              </motion.div>
              <motion.div
                animate={reduceMotion ? {} : { scale: [1, 1.035, 1], opacity: [0.55, 0.9, 0.55] }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                className="absolute size-56 rounded-full border border-[#7C8DFF]/20 bg-[#7C8DFF]/[0.025]"
              />
              <div className="absolute h-px w-[30rem] bg-[linear-gradient(90deg,transparent,#7C8DFF33,#58D6C733,transparent)]" />
              <div className="absolute h-[26rem] w-px bg-[linear-gradient(transparent,#7C8DFF22,transparent)]" />
              <span className="grid size-20 place-items-center rounded-[1.7rem] border border-[#7C8DFF]/20 bg-[#10141D]/80 shadow-[0_0_80px_rgba(124,141,255,0.16)] backdrop-blur-xl">
                <LockKeyhole className="size-6 text-[#9DA9FF]" />
              </span>
            </div>
          </div>
        </section>

        <section className="relative z-20 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-10 lg:pb-8">
          <motion.div
            initial={skipIntro ? false : { opacity: 0, y: 24 }}
            animate={showIntro ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: skipIntro ? 0 : 0.38, duration: skipIntro ? 0 : 0.5, ease: "easeOut" }}
            className="mx-auto max-w-7xl rounded-[1.6rem] border border-white/[0.08] bg-[#10131A]/95 p-4 shadow-[0_-18px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5"
          >
            <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[0.62fr_1fr_1fr_auto] lg:items-end">
              <div className="hidden pb-1 lg:block">
                <p className="ui-section-title text-[#D6DAE2]">Enter workspace</p>
                <p className="ui-meta mt-1 text-[#A5AEBE]">Authorised users only</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.12em] text-[#A6AFBE]">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required defaultValue="analyst@traceframe.local" className="h-11 rounded-xl border-white/[0.08] bg-white/[0.035] px-4 text-sm tracking-[0.025em] text-[#F5F7FA] focus-visible:border-[#7C8DFF]/60 focus-visible:ring-[#7C8DFF]/15" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" className="text-xs font-medium uppercase tracking-[0.12em] text-[#A6AFBE]">Password</Label>
                  <span className="whitespace-nowrap text-sm leading-6 tracking-[0.03em] text-[#A5AEBE]">Demo: Traceframe!2026</span>
                </div>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required minLength={8} className="h-11 rounded-xl border-white/[0.08] bg-white/[0.035] px-4 pr-11 text-sm tracking-[0.025em] text-[#F5F7FA] focus-visible:border-[#7C8DFF]/60 focus-visible:ring-[#7C8DFF]/15" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#667083] hover:text-[#C3C9D3]" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={isSubmitting || isEnteringWorkspace} className="h-11 w-full justify-center rounded-xl bg-[#7C8DFF] px-4 text-sm font-semibold tracking-[0.035em] text-[#090B10] hover:bg-[#93A1FF] lg:w-36">
                {isSubmitting ? <><LoaderCircle className="animate-spin" /> Checking…</> : <>Continue <ArrowRight /></>}
              </Button>
            </form>

            {error ? (
              <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} role="alert" className="ui-meta mt-3 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-4 py-2.5 text-red-200 lg:ml-[15.5%]">
                {error}
              </motion.p>
            ) : null}
          </motion.div>
        </section>
      </motion.main>

      <AnimatePresence>
        {isEnteringWorkspace ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-[#080A0F]">
            <motion.div initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: [0.6, 1.08, 1], rotate: 0 }} transition={{ duration: 0.55, ease: "easeOut" }} className="relative grid size-28 place-items-center rounded-[2rem] border border-[#7C8DFF]/25 bg-[#111620] text-[#9FACFF] shadow-[0_0_90px_rgba(124,141,255,0.2)]">
              <ScanLine className="size-11" />
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 2.2, opacity: [0, 0.5, 0] }} transition={{ duration: 0.7 }} className="absolute inset-0 rounded-[2rem] border border-[#58D6C7]/45" />
            </motion.div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="absolute mt-48 text-base font-medium tracking-[0.12em] text-[#DCE2EA]">Opening secure workspace</motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
