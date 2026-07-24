"use client";

import {
  Box,
  CircleAlert,
  CircleCheck,
  Database,
  HardDrive,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/lib/http/client";
import type {
  OperationalServiceId,
  OperationalState,
  OperationsStatus,
} from "@/lib/operations/contracts";

const services: Array<{
  id: OperationalServiceId;
  icon: typeof Box;
  name: string;
  purpose: string;
}> = [
  { id: "web", icon: Box, name: "Next.js", purpose: "Interface and API" },
  { id: "database", icon: Database, name: "PostgreSQL", purpose: "Cases and sessions" },
  { id: "worker", icon: Workflow, name: "Python", purpose: "Background processing" },
  { id: "storage", icon: HardDrive, name: "Object storage", purpose: "Source material" },
];

const stateStyles: Record<OperationalState | "checking", string> = {
  available: "bg-[#58D6C7]/[0.08] text-[#83E8DC] ring-[#58D6C7]/20",
  degraded: "bg-amber-300/[0.08] text-amber-200 ring-amber-300/20",
  unavailable: "bg-red-300/[0.08] text-red-200 ring-red-300/20",
  checking: "bg-white/[0.05] text-[#AAB3C1] ring-white/[0.08]",
};

function checkedAtLabel(value: string | undefined) {
  if (!value) return "Waiting for first status check";
  return `Checked ${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))}`;
}

export function ArchitectureWorkspace() {
  const [operations, setOperations] = useState<OperationsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    const result = await apiRequest<OperationsStatus>(
      "/api/operations/status",
      { signal },
    );
    if (result.ok) {
      setOperations(result.data);
      setError(null);
    } else if (!signal?.aborted) {
      setError(result.error);
    }
    if (!signal?.aborted) setIsRefreshing(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => {
      void loadStatus(controller.signal);
    }, 0);
    const interval = window.setInterval(() => {
      void loadStatus(controller.signal);
    }, 15_000);
    return () => {
      controller.abort();
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadStatus]);

  const serviceStatus = new Map(
    operations?.services.map((service) => [service.id, service]) ?? [],
  );

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-eyebrow text-[#8794FF]">System design</p>
          <h1 className="ui-page-title mt-3 max-w-2xl">
            Four focused services. One public boundary.
          </h1>
          <p className="ui-body mt-5 max-w-xl text-[#B0B8C6]">
            Next.js owns the browser experience while data and processing remain
            isolated inside the application network.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div aria-live="polite" className="text-right">
            <p className="ui-label text-[#D4D9E3]">
              {operations?.status === "operational"
                ? "All systems available"
                : operations
                  ? "Attention required"
                  : "Checking systems"}
            </p>
            <p className="ui-meta mt-1 text-[#949EAE]">
              {checkedAtLabel(operations?.checkedAt)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Refresh operational status"
            title="Refresh operational status"
            onClick={() => {
              setIsRefreshing(true);
              void loadStatus();
            }}
            disabled={isRefreshing}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-[#AEB7C6] transition hover:border-primary/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-7 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] px-4 py-3 text-amber-100"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="ui-meta">
            {error} The last successful status remains visible.
          </p>
        </div>
      ) : null}

      <div className="relative mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="pointer-events-none absolute left-[8%] right-[8%] top-8 hidden h-px bg-[linear-gradient(90deg,transparent,#7C8DFF55,#58D6C744,transparent)] xl:block" />
        {services.map(({ id, icon: Icon, name, purpose }, index) => {
          const service = serviceStatus.get(id);
          const state = service?.state ?? "checking";
          return (
            <article
              key={id}
              aria-label={`${name} status ${state}`}
              className="relative min-w-0 rounded-[1.35rem] border border-white/[0.07] bg-navigation p-5"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="ui-meta font-mono text-[#8791A2]">
                  0{index + 1}
                </span>
              </div>
              <div className="mt-8 flex min-w-0 items-center justify-between gap-3">
                <h2 className="ui-section-title truncate">{name}</h2>
                <span
                  className={`ui-label shrink-0 rounded-full px-2 py-1 text-[0.62rem] uppercase ring-1 ring-inset ${stateStyles[state]}`}
                >
                  {state}
                </span>
              </div>
              <p className="ui-meta mt-2 text-[#B0B8C6]">{purpose}</p>
              <p className="ui-meta mt-5 min-h-10 text-[#929CAD]">
                {service?.detail ?? "Waiting for a protected status response"}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.35rem] border border-[#58D6C7]/10 bg-[#58D6C7]/[0.035] p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="ui-eyebrow text-[#6EDFD2]">Public surface</p>
            <CircleCheck className="size-4 text-[#69DCCE]" aria-hidden="true" />
          </div>
          <p className="ui-body mt-3 text-[#B8C0CC]">
            Only the web application is exposed to users.
          </p>
        </div>
        <div
          aria-label="Evidence pipeline status"
          className="rounded-[1.35rem] border border-white/[0.07] bg-white/[0.018] p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ui-eyebrow text-[#9AA4B5]">Pipeline pulse</p>
              <p className="ui-body mt-3 text-[#B8C0CC]">
                Aggregate job state only. Case and source details remain private.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:min-w-[19rem]">
              {[
                ["Queued", operations?.pipeline.queued],
                ["Active", operations?.pipeline.processing],
                ["Failed", operations?.pipeline.failed],
                ["Disposal", operations?.pipeline.disposalPending],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-white/[0.06] bg-black/10 px-2 py-3 text-center"
                >
                  <p className="text-lg font-medium text-[#E7EAF0]">
                    {value ?? "—"}
                  </p>
                  <p className="mt-1 text-[0.62rem] uppercase tracking-[0.08em] text-[#929CAD]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
