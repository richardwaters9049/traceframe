"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Archive, ArrowLeft, Check, CircleCheckBig, CircleX, Clock3, Database,
  Download, Eye, FileText, Fingerprint, LoaderCircle, LockKeyhole, PackageCheck, Printer, RefreshCw,
  RotateCcw, SearchCheck, ShieldCheck, ShieldOff, Upload, X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { CaseLifecycleDialog } from "@/components/cases/case-lifecycle-dialog";
import type { CaseWorkspaceRecord } from "@/components/cases/workspace-content";
import { CasePrintSummary } from "@/components/cases/case-print-summary";
import { CaseRelationships } from "@/components/cases/case-relationships";
import { SourceDisposalDialog } from "@/components/cases/source-disposal-dialog";
import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import type { CaseRecord } from "@/lib/cases/contracts";
import type { FindingRecord } from "@/lib/findings/contracts";
import { apiRequest } from "@/lib/http/client";
import { observationKindLabel, type SourceRecord } from "@/lib/sources/contracts";

type WorkspaceTab = "analysis" | "sources" | "findings" | "relationships";
type FindingStatusFilter = "all" | FindingRecord["status"];
type FindingKindFilter = "all" | FindingRecord["kind"];

const findingStatusFilters: FindingStatusFilter[] = ["all", "proposed", "confirmed", "dismissed"];

function statusStyles(status: SourceRecord["status"]) {
  if (status === "ready") return "bg-[#58D6C7]/10 text-[#76E2D5] ring-[#58D6C7]/20";
  if (status === "failed") return "bg-[#FF7D8D]/10 text-[#FF9BA7] ring-[#FF7D8D]/20";
  return "bg-primary/10 text-[#9AA7FF] ring-primary/20";
}

function readableBytes(value: number) {
  return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KiB`;
}

function auditLabel(action: string) {
  if (action === "source.uploaded") return "Source uploaded";
  if (action === "source.disposal_requested") return "Source disposal requested";
  if (action === "finding.proposed") return "Finding proposed";
  if (action === "finding.confirmed") return "Finding confirmed";
  if (action === "finding.dismissed") return "Finding dismissed";
  if (action === "case.closed") return "Case closed";
  if (action === "case.reopened") return "Case reopened";
  return "Case created";
}

export function CaseWorkspace({ workspace }: { workspace: CaseWorkspaceRecord }) {
  const router = useRouter();
  const { showDashboard } = useWorkspaceUI();
  const [tab, setTab] = useState<WorkspaceTab>(workspace.sources.length ? "sources" : "analysis");
  const [record, setRecord] = useState(workspace.case);
  const [sources, setSources] = useState(workspace.sources);
  const [findings, setFindings] = useState(workspace.findings);
  const [findingSummary, setFindingSummary] = useState(workspace.findingSummary);
  const [auditEvents, setAuditEvents] = useState(workspace.auditEvents);
  const [verification, setVerification] = useState(workspace.verification);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedObservationId, setSelectedObservationId] = useState("");
  const [analystNote, setAnalystNote] = useState("");
  const [reviewRationales, setReviewRationales] = useState<Record<string, string>>({});
  const [findingAction, setFindingAction] = useState<string | null>(null);
  const [findingStatusFilter, setFindingStatusFilter] = useState<FindingStatusFilter>("all");
  const [findingKindFilter, setFindingKindFilter] = useState<FindingKindFilter>("all");
  const [bundleDownloading, setBundleDownloading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<CaseRecord["status"] | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [lifecycleOpener, setLifecycleOpener] = useState<HTMLElement | null>(null);
  const [lifecycleMessage, setLifecycleMessage] = useState<string | null>(null);
  const [disposalSource, setDisposalSource] = useState<SourceRecord | null>(null);
  const [disposalBusy, setDisposalBusy] = useState(false);
  const [disposalError, setDisposalError] = useState<string | null>(null);
  const [disposalOpener, setDisposalOpener] = useState<HTMLElement | null>(null);
  const [disposalMessage, setDisposalMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isClosed = record.status === "closed";
  const createdAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt));
  const verificationLabel = verification.status === "verified"
    ? "Global ledger verified"
    : verification.status === "broken" ? "Ledger integrity failed" : "Verification unavailable";
  const processing = sources.some((source) => source.status === "queued" || source.status === "processing");
  const sourceActivity = processing || sources.some((source) => source.objectStatus === "disposal_pending");
  const observations = sources.flatMap((source) => source.observations.map((observation) => ({ ...observation, sourceFilename: source.originalFilename })));
  const promotedObservationIds = new Set(findings.map((finding) => finding.observationId));
  const availableObservations = observations.filter((observation) => !promotedObservationIds.has(observation.id));
  const filteredFindings = findings.filter((finding) =>
    (findingStatusFilter === "all" || finding.status === findingStatusFilter)
    && (findingKindFilter === "all" || finding.kind === findingKindFilter));
  const reviewedFindingCount = findingSummary.confirmed + findingSummary.dismissed;

  function downloadReviewedFindings(format: "csv" | "json") {
    window.location.assign(`/api/cases/${encodeURIComponent(record.id)}/findings/export?format=${format}`);
  }

  async function downloadReviewedBundle() {
    if (!reviewedFindingCount || verification.status !== "verified" || bundleDownloading) return;
    setBundleDownloading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/cases/${encodeURIComponent(record.id)}/findings/export?format=bundle`,
        { headers: { Accept: "application/zip" } },
      );
      if (!response.ok) {
        const body = response.headers.get("content-type")?.includes("application/json")
          ? await response.json() as { error?: unknown }
          : null;
        setMessage({
          tone: "error",
          text: typeof body?.error === "string" ? body.error : "The hand-off bundle could not be created.",
        });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `traceframe-case-${record.id}-reviewed-findings.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage({ tone: "success", text: "Verified hand-off bundle prepared." });
    } catch {
      setMessage({ tone: "error", text: "Traceframe could not prepare the hand-off bundle." });
    } finally {
      setBundleDownloading(false);
    }
  }

  async function refreshWorkspace() {
    const refreshed = await apiRequest<{ workspace: CaseWorkspaceRecord }>(`/api/cases/${encodeURIComponent(record.id)}`);
    if (!refreshed.ok) return false;
    setRecord(refreshed.data.workspace.case);
    setSources(refreshed.data.workspace.sources);
    setFindings(refreshed.data.workspace.findings);
    setFindingSummary(refreshed.data.workspace.findingSummary);
    setAuditEvents(refreshed.data.workspace.auditEvents);
    setVerification(refreshed.data.workspace.verification);
    return true;
  }

  function openLifecycleDialog(targetStatus: CaseRecord["status"], opener: HTMLElement) {
    setLifecycleTarget(targetStatus);
    setLifecycleOpener(opener);
    setLifecycleError(null);
  }

  function closeLifecycleDialog() {
    if (lifecycleBusy) return;
    setLifecycleTarget(null);
    setLifecycleError(null);
  }

  async function confirmLifecycleChange() {
    if (!lifecycleTarget || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    const result = await apiRequest<{ case: CaseRecord }>(
      `/api/cases/${encodeURIComponent(record.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: lifecycleTarget }),
      },
    );
    if (result.ok) {
      setRecord(result.data.case);
      await refreshWorkspace();
      router.refresh();
      setLifecycleMessage(result.data.case.status === "closed"
        ? "Case closed and preserved as read-only."
        : "Case reopened for further investigation.");
      setLifecycleTarget(null);
    } else {
      setLifecycleError(result.error);
    }
    setLifecycleBusy(false);
  }

  function openDisposalDialog(source: SourceRecord, opener: HTMLElement) {
    setDisposalSource(source);
    setDisposalOpener(opener);
    setDisposalError(null);
  }

  function closeDisposalDialog() {
    if (disposalBusy) return;
    setDisposalSource(null);
    setDisposalError(null);
  }

  async function confirmSourceDisposal() {
    if (!disposalSource || disposalBusy) return;
    setDisposalBusy(true);
    setDisposalError(null);
    setDisposalMessage(null);
    const result = await apiRequest<{ sourceId: string; objectStatus: SourceRecord["objectStatus"] }>(
      `/api/cases/${encodeURIComponent(record.id)}/sources/${encodeURIComponent(disposalSource.id)}`,
      { method: "DELETE" },
    );
    if (result.ok) {
      await refreshWorkspace();
      setDisposalMessage("Original disposal queued. Provenance and derived analysis are preserved.");
      setDisposalSource(null);
    } else {
      setDisposalError(result.error);
    }
    setDisposalBusy(false);
  }

  useEffect(() => {
    if (!sourceActivity) return;
    const controller = new AbortController();
    const refresh = async () => {
      const result = await apiRequest<{ sources: SourceRecord[] }>(
        `/api/cases/${encodeURIComponent(record.id)}/sources`, { signal: controller.signal }, 5_000,
      );
      if (result.ok) setSources(result.data.sources);
    };
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [sourceActivity, record.id]);

  async function uploadSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || uploading) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", selectedFile);
    const result = await apiRequest<{ sourceId: string; status: string }>(
      `/api/cases/${encodeURIComponent(record.id)}/sources`, { method: "POST", body: form }, 30_000,
    );
    if (result.ok) {
      await refreshWorkspace();
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage({ tone: "success", text: "Source secured and queued for analysis." });
    } else {
      setMessage({ tone: "error", text: result.error });
    }
    setUploading(false);
  }

  async function proposeObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedObservationId || findingAction) return;
    setFindingAction("propose");
    setMessage(null);
    const result = await apiRequest<{ findingId: string; status: string }>(
      `/api/cases/${encodeURIComponent(record.id)}/findings`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ observationId: selectedObservationId, note: analystNote }) },
    );
    if (result.ok) {
      await refreshWorkspace();
      setSelectedObservationId("");
      setAnalystNote("");
      setMessage({ tone: "success", text: "Observation promoted for analyst review." });
    } else setMessage({ tone: "error", text: result.error });
    setFindingAction(null);
  }

  async function decideFinding(finding: FindingRecord, status: "confirmed" | "dismissed") {
    if (findingAction) return;
    setFindingAction(`${finding.id}:${status}`);
    setMessage(null);
    const result = await apiRequest<{ findingId: string; status: string }>(
      `/api/cases/${encodeURIComponent(record.id)}/findings/${encodeURIComponent(finding.id)}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, rationale: reviewRationales[finding.id] ?? "" }) },
    );
    if (result.ok) {
      await refreshWorkspace();
      setReviewRationales((current) => ({ ...current, [finding.id]: "" }));
      setMessage({ tone: "success", text: `Finding ${status}.` });
    } else setMessage({ tone: "error", text: result.error });
    setFindingAction(null);
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <button type="button" onClick={showDashboard} className="ui-label inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.09] bg-primary px-3.5 py-2 text-background transition hover:bg-primary-hover hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><ArrowLeft className="size-4" />Back to dashboard</button>
      <div className="mt-7 flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
        <div className="max-w-3xl"><div className="ui-eyebrow flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 ring-1 ring-inset ${isClosed ? "bg-white/[0.05] text-[#B4BDCA] ring-white/[0.09]" : "bg-[#58D6C7]/[0.08] text-[#72DFD2] ring-[#58D6C7]/15"}`}>{record.status}</span><span className="rounded-full bg-white/[0.045] px-2.5 py-1 text-[#B3BBC8] ring-1 ring-inset ring-white/[0.07]">{record.priority}</span></div><h1 className="ui-page-title mt-4 text-balance">{record.title}</h1><p className="ui-body mt-4 max-w-2xl whitespace-pre-wrap text-[#B4BDCA]">{record.summary || "No initial context was recorded for this case."}</p></div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <span className="ui-meta inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[#AEB7C5]"><Clock3 className="size-4 text-[#8594FF]" />{createdAt}</span>
          {workspace.capabilities.canManageCase ? (
            <button
              type="button"
              onClick={(event) => openLifecycleDialog(isClosed ? "open" : "closed", event.currentTarget)}
              className={`ui-label inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isClosed ? "border-[#58D6C7]/20 bg-[#58D6C7]/[0.07] text-[#8AE9DE] hover:bg-[#58D6C7]/[0.12]" : "border-amber-200/15 bg-amber-200/[0.055] text-amber-100 hover:bg-amber-200/[0.1]"}`}
            >
              {isClosed ? <RotateCcw className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
              {isClosed ? "Reopen case" : "Close case"}
            </button>
          ) : null}
        </div>
      </div>

      {isClosed ? (
        <div className="ui-meta mt-6 flex items-start gap-3 rounded-2xl border border-white/[0.075] bg-white/[0.025] p-4 text-[#BAC2CD]">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[#95A2FF]" aria-hidden="true" />
          <p>This case is preserved as read-only. Reopen it before adding sources, proposing findings, or recording review decisions.</p>
        </div>
      ) : null}
      {lifecycleMessage ? <p role="status" className="ui-meta mt-4 text-[#76E2D5]">{lifecycleMessage}</p> : null}

      <div role="tablist" aria-label="Case workspace" className="ui-label mt-10 flex flex-wrap gap-x-5 gap-y-3 border-b border-white/[0.065] text-[#98A2B2] sm:gap-x-7">
        {(["analysis", "sources", "findings", "relationships"] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} type="button" onClick={() => setTab(value)} className={`cursor-pointer border-b-2 pb-3 capitalize transition ${tab === value ? "border-[#7C8DFF] text-[#E3E7ED]" : "border-transparent hover:text-white"}`}>{value}{value === "sources" && sources.length ? ` · ${sources.length}` : value === "findings" && findings.length ? ` · ${findings.length}` : ""}</button>)}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "analysis" ? (
            <motion.div key="analysis" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="min-h-[28rem] min-w-0 rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5 sm:p-7">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]"><FileText className="size-5" /></span><div><h2 className="ui-section-title">Analysis workspace</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">{sources.length ? `${sources.length} source${sources.length === 1 ? "" : "s"} attached` : "Case established"}</p></div></div>
              <div className="mt-7 grid min-h-[20rem] place-items-center rounded-2xl border border-dashed border-white/[0.075] bg-white/[0.012] p-8 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-[#58D6C7]/[0.06] text-[#69DCCE]"><Check className="size-5" /></span><h3 className="ui-section-title mt-4">{sources.length ? "Evidence pipeline active" : isClosed ? "Case preserved without sources" : "Ready for source material"}</h3><p className="ui-meta mt-2 max-w-md text-[#AAB3C1]">{sources.length ? "Open Sources to inspect provenance, processing health, and derived indicators." : isClosed ? "Reopen the case if further source material needs to be attached." : "Add a small synthetic text source to begin the evidence-led workflow."}</p>{!sources.length && !isClosed ? <button type="button" onClick={() => setTab("sources")} className="ui-label mt-5 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-background transition hover:bg-primary-hover hover:text-white">Add first source</button> : null}</div></div>
            </motion.div>
          ) : tab === "sources" ? (
            <motion.div key="sources" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="min-h-[28rem] min-w-0 rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]"><Database className="size-5" /></span><div><h2 className="ui-section-title">Source material</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">Originals retained by policy · analysis derived</p></div></div>{sourceActivity ? <span className="ui-meta inline-flex items-center gap-2 text-[#9AA7FF]"><RefreshCw className="size-4 animate-spin" />Lifecycle updates live</span> : null}</div>

              {!isClosed ? <form onSubmit={uploadSource} className="mt-6 rounded-2xl border border-dashed border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center"><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0D1118] px-4 py-3 transition hover:border-primary/35"><Upload className="size-5 shrink-0 text-[#8796FF]" /><span className="min-w-0"><span className="ui-label block truncate text-[#DDE2EA]">{selectedFile?.name ?? "Choose synthetic source"}</span><span className="ui-meta mt-0.5 block text-[#9FA9B8]">UTF-8 TXT, LOG, CSV or JSON · 1 MiB maximum</span></span><input ref={inputRef} type="file" name="file" accept=".txt,.log,.csv,.json,text/plain,text/csv,application/json" className="sr-only" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setMessage(null); }} /></label><button type="submit" disabled={!selectedFile || uploading} className="ui-label inline-flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-background transition hover:bg-primary-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-45">{uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{uploading ? "Securing…" : "Upload"}</button></div>
              </form> : <p className="ui-meta mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-[#AAB3C1]">Source upload is unavailable while this case is closed.</p>}
              {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`ui-meta mt-3 flex items-center gap-2 ${message.tone === "error" ? "text-[#FF9BA7]" : "text-[#76E2D5]"}`}>{message.tone === "error" ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}{message.text}</p> : null}
              {disposalMessage ? <p role="status" className="ui-meta mt-3 flex items-center gap-2 text-[#76E2D5]"><ShieldCheck className="size-4" />{disposalMessage}</p> : null}

              <div className="mt-5 space-y-3">
                {!sources.length ? <div className="grid min-h-48 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.012] p-8 text-center"><div><Eye className="mx-auto size-6 text-[#7484F4]" /><p className="ui-section-title mt-3">No source material yet</p><p className="ui-meta mt-2 text-[#AAB3C1]">The original stays in object storage; only provenance and derived analysis appear here.</p></div></div> : null}
                {sources.map((source) => <article key={source.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><p className="ui-section-title truncate">{source.originalFilename}</p><p className="ui-meta mt-1 text-[#AAB3C1]">{readableBytes(source.sizeBytes)} · {source.mediaType} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.createdAt))}</p></div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <span className={`ui-eyebrow inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${statusStyles(source.status)}`}>{source.status === "queued" || source.status === "processing" ? <LoaderCircle className="size-3.5 animate-spin" /> : source.status === "ready" ? <Check className="size-3.5" /> : <X className="size-3.5" />}{source.status}</span>
                      <span className={`ui-eyebrow inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${source.objectStatus === "retained" ? "bg-[#58D6C7]/10 text-[#76E2D5] ring-[#58D6C7]/20" : source.objectStatus === "disposed" ? "bg-white/[0.045] text-[#AEB7C5] ring-white/[0.08]" : source.objectStatus === "disposal_failed" ? "bg-[#FF7D8D]/10 text-[#FF9BA7] ring-[#FF7D8D]/20" : "bg-amber-300/[0.08] text-amber-200 ring-amber-200/15"}`}>
                        {source.objectStatus === "disposal_pending" ? <LoaderCircle className="size-3.5 animate-spin" /> : source.objectStatus === "retained" ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />}
                        {source.objectStatus === "retained" ? "original retained" : source.objectStatus === "disposal_pending" ? "disposal queued" : source.objectStatus === "disposed" ? "original disposed" : "disposal failed"}
                      </span>
                    </div>
                  </div>
                  <p className="ui-meta mt-3 truncate font-mono text-[#8993A4]" title={source.sha256}>SHA-256 {source.sha256}</p>
                  {source.status === "ready" ? <><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/[0.025] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Characters</p><p className="ui-section-title mt-1">{source.characterCount}</p></div><div className="rounded-xl bg-white/[0.025] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Lines</p><p className="ui-section-title mt-1">{source.lineCount}</p></div><div className="rounded-xl bg-white/[0.025] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Words</p><p className="ui-section-title mt-1">{source.wordCount}</p></div></div>{source.observations.length ? <div className="mt-4 flex flex-wrap gap-2">{source.observations.map((observation) => <span key={observation.id} className="ui-meta max-w-full truncate rounded-lg bg-[#58D6C7]/[0.055] px-2.5 py-1.5 text-[#8FDCD3] ring-1 ring-inset ring-[#58D6C7]/10">{observationKindLabel(observation.kind)} · {observation.value}{observation.occurrences > 1 ? ` ×${observation.occurrences}` : ""}</span>)}</div> : <p className="ui-meta mt-4 text-[#9FA9B8]">No supported indicators were derived.</p>}</> : null}
                  {source.failureReason ? <p role="alert" className="ui-meta mt-3 text-[#FF9BA7]">{source.failureReason}</p> : null}
                  {source.disposalFailureReason ? <p role="alert" className="ui-meta mt-3 text-[#FF9BA7]">{source.disposalFailureReason}</p> : null}
                  {!isClosed && workspace.capabilities.canDisposeSources && (source.objectStatus === "retained" || source.objectStatus === "disposal_failed") && source.status !== "queued" && source.status !== "processing" ? <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-4"><button type="button" aria-label={`${source.objectStatus === "disposal_failed" ? "Retry disposal for" : "Dispose original"} ${source.originalFilename}`} onClick={(event) => openDisposalDialog(source, event.currentTarget)} className="ui-meta inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#FF7D8D]/15 bg-[#FF7D8D]/[0.045] px-3.5 py-2.5 text-[#FFABB5] transition hover:border-[#FF7D8D]/30 hover:bg-[#FF7D8D]/[0.08]"><ShieldOff className="size-4" />{source.objectStatus === "disposal_failed" ? "Retry disposal" : "Dispose original"}</button></div> : null}
                </article>)}
              </div>
            </motion.div>
          ) : tab === "findings" ? (
            <motion.div key="findings" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="min-h-[28rem] min-w-0 rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]"><SearchCheck className="size-5" /></span><div><h2 className="ui-section-title">Analyst findings</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">Machine observed · human reviewed</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadReviewedFindings("csv")} disabled={!reviewedFindingCount} className="ui-meta inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-[#B8C0CB] transition hover:border-primary/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" title="Download reviewed findings as CSV"><Download className="size-3.5" />CSV</button><button type="button" onClick={() => downloadReviewedFindings("json")} disabled={!reviewedFindingCount} className="ui-meta inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-[#B8C0CB] transition hover:border-primary/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" title="Download reviewed findings as JSON"><Download className="size-3.5" />JSON</button><button type="button" onClick={() => void downloadReviewedBundle()} disabled={!reviewedFindingCount || verification.status !== "verified" || bundleDownloading} className="ui-meta inline-flex min-w-[5.4rem] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#58D6C7]/15 bg-[#58D6C7]/[0.045] px-2.5 py-2 text-[#8FDCD3] transition hover:border-[#58D6C7]/30 hover:text-[#B5F2EB] disabled:cursor-not-allowed disabled:opacity-40" title={verification.status === "verified" ? "Download verified hand-off bundle" : "Verify the audit ledger before creating a bundle"}>{bundleDownloading ? <LoaderCircle className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />}{bundleDownloading ? "Preparing" : "Bundle"}</button><button type="button" onClick={() => window.print()} className="ui-meta inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-[#B8C0CB] transition hover:border-primary/30 hover:text-white" title="Print case summary"><Printer className="size-3.5" />Print</button></div></div>

              <div aria-label="Finding summary" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ["Total", findingSummary.total],
                  ["Proposed", findingSummary.proposed],
                  ["Confirmed", findingSummary.confirmed],
                  ["Dismissed", findingSummary.dismissed],
                ] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.055] bg-white/[0.02] p-3"><p className="ui-eyebrow text-[#7F8A9B]">{label}</p><p className="ui-section-title mt-1 tabular-nums">{value}</p></div>)}
              </div>

              {!isClosed && workspace.capabilities.canCreateFindings && availableObservations.length ? (
                <form onSubmit={proposeObservation} className="mt-6 rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
                  <label className="ui-label block text-[#DDE2EA]" htmlFor="finding-observation">Promote an observation</label>
                  <select id="finding-observation" value={selectedObservationId} onChange={(event) => setSelectedObservationId(event.target.value)} className="ui-meta mt-2 w-full cursor-pointer rounded-xl border border-white/[0.09] bg-[#0D1118] px-3 py-3 text-[#D8DEE7] outline-none transition focus:border-primary/50">
                    <option value="">Choose a machine-derived observation</option>
                    {availableObservations.map((observation) => <option key={observation.id} value={observation.id}>{observationKindLabel(observation.kind)} · {observation.value} · {observation.sourceFilename}</option>)}
                  </select>
                  <label className="ui-label mt-4 block text-[#DDE2EA]" htmlFor="finding-note">Analyst note</label>
                  <textarea id="finding-note" value={analystNote} onChange={(event) => setAnalystNote(event.target.value)} maxLength={500} rows={3} placeholder="Explain why this observation merits review." className="ui-meta mt-2 w-full resize-y rounded-xl border border-white/[0.09] bg-[#0D1118] px-3 py-3 text-[#D8DEE7] outline-none transition placeholder:text-[#768091] focus:border-primary/50" />
                  <div className="mt-3 flex items-center justify-between gap-4"><span className="ui-meta text-[#8F99AA]">{analystNote.length}/500</span><button type="submit" disabled={!selectedObservationId || analystNote.trim().length < 3 || findingAction !== null} className="ui-label inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-background transition hover:bg-primary-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-45">{findingAction === "propose" ? <LoaderCircle className="size-4 animate-spin" /> : <SearchCheck className="size-4" />}Propose finding</button></div>
                </form>
              ) : null}

              {isClosed ? <p className="ui-meta mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-[#AAB3C1]">Finding proposals and review decisions are unavailable while this case is closed.</p> : null}
              {!isClosed && !workspace.capabilities.canCreateFindings ? <p className="ui-meta mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-[#AAB3C1]">Findings are read-only for your workspace role.</p> : null}
              {!isClosed && workspace.capabilities.canCreateFindings && observations.length > 0 && availableObservations.length === 0 ? <p className="ui-meta mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-[#AAB3C1]">Every derived observation has already been promoted.</p> : null}
              {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`ui-meta mt-4 flex items-center gap-2 ${message.tone === "error" ? "text-[#FF9BA7]" : "text-[#76E2D5]"}`}>{message.tone === "error" ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}{message.text}</p> : null}

              {findings.length ? <div className="mt-5 rounded-2xl border border-white/[0.065] bg-white/[0.012] p-3 sm:p-4"><div className="flex flex-col gap-3"><div role="group" aria-label="Filter findings by status" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{findingStatusFilters.map((status) => {
                const count = status === "all" ? findingSummary.total : findingSummary[status];
                return <button key={status} type="button" aria-pressed={findingStatusFilter === status} onClick={() => setFindingStatusFilter(status)} className={`ui-meta cursor-pointer rounded-lg px-2.5 py-1.5 capitalize ring-1 ring-inset transition ${findingStatusFilter === status ? "bg-primary/15 text-[#B7C0FF] ring-primary/30" : "bg-white/[0.025] text-[#AAB3C1] ring-white/[0.07] hover:text-white"}`}>{status} · {count}</button>;
              })}</div><div className="flex items-center justify-end gap-3"><label htmlFor="finding-kind-filter" className="ui-meta shrink-0 text-[#8F99AA]">Indicator</label><select id="finding-kind-filter" value={findingKindFilter} onChange={(event) => setFindingKindFilter(event.target.value as FindingKindFilter)} className="ui-meta min-w-32 cursor-pointer rounded-lg border border-white/[0.08] bg-[#0D1118] px-2.5 py-2 text-[#D3D9E2] outline-none focus:border-primary/45"><option value="all">All types</option><option value="email">Email · {findingSummary.byKind.email}</option><option value="url">URL · {findingSummary.byKind.url}</option><option value="ipv4">IPv4 · {findingSummary.byKind.ipv4}</option><option value="domain">Domain · {findingSummary.byKind.domain}</option><option value="sha256">SHA-256 · {findingSummary.byKind.sha256}</option><option value="user_agent">User agent · {findingSummary.byKind.user_agent}</option></select></div></div><p aria-live="polite" className="ui-meta mt-3 text-[#8F99AA]">Showing {filteredFindings.length} of {findingSummary.total} findings</p></div> : null}

              <div className="mt-5 space-y-3">
                {!observations.length ? <div className="grid min-h-48 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.012] p-8 text-center"><div><SearchCheck className="mx-auto size-6 text-[#7484F4]" /><p className="ui-section-title mt-3">No observations to review</p><p className="ui-meta mt-2 text-[#AAB3C1]">Process a synthetic source before creating an analyst finding.</p></div></div> : null}
                {observations.length > 0 && !findings.length ? <div className="rounded-2xl border border-dashed border-white/[0.075] bg-white/[0.012] p-6 text-center"><p className="ui-section-title">No findings proposed</p><p className="ui-meta mt-2 text-[#AAB3C1]">Promote a machine-derived observation and record your reasoning.</p></div> : null}
                {findings.length > 0 && !filteredFindings.length ? <div className="rounded-2xl border border-dashed border-white/[0.075] bg-white/[0.012] p-6 text-center"><p className="ui-section-title">No matching findings</p><p className="ui-meta mt-2 text-[#AAB3C1]">Adjust the status or indicator filter to see other decisions.</p></div> : null}
                {filteredFindings.map((finding) => <article key={finding.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="ui-eyebrow text-[#8F99AA]">{observationKindLabel(finding.kind)} · {finding.sourceFilename}</p><p className="ui-section-title mt-1 break-all">{finding.value}{finding.occurrences > 1 ? ` ×${finding.occurrences}` : ""}</p></div><span className={`ui-eyebrow inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${finding.status === "confirmed" ? "bg-[#58D6C7]/10 text-[#76E2D5] ring-[#58D6C7]/20" : finding.status === "dismissed" ? "bg-white/[0.045] text-[#AEB7C5] ring-white/[0.08]" : "bg-primary/10 text-[#9AA7FF] ring-primary/20"}`}>{finding.status === "confirmed" ? <CircleCheckBig className="size-3.5" /> : finding.status === "dismissed" ? <CircleX className="size-3.5" /> : <LoaderCircle className="size-3.5" />}{finding.status}</span></div>
                  <div className="mt-4 rounded-xl bg-white/[0.025] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Analyst note · {finding.createdBy}</p><p className="ui-meta mt-2 whitespace-pre-wrap text-[#C1C8D2]">{finding.analystNote}</p></div>
                  {finding.status === "proposed" && !isClosed && workspace.capabilities.canReviewFindings ? <div className="mt-4"><label htmlFor={`rationale-${finding.id}`} className="ui-label text-[#DDE2EA]">Review rationale</label><textarea id={`rationale-${finding.id}`} value={reviewRationales[finding.id] ?? ""} onChange={(event) => setReviewRationales((current) => ({ ...current, [finding.id]: event.target.value }))} maxLength={500} rows={2} placeholder="Record why this finding should be confirmed or dismissed." className="ui-meta mt-2 w-full resize-y rounded-xl border border-white/[0.09] bg-[#0D1118] px-3 py-3 text-[#D8DEE7] outline-none transition placeholder:text-[#768091] focus:border-primary/50" /><div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void decideFinding(finding, "dismissed")} disabled={(reviewRationales[finding.id]?.trim().length ?? 0) < 3 || findingAction !== null} className="ui-label inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.1] px-3.5 py-2.5 text-[#C3CAD4] transition hover:border-[#FF7D8D]/30 hover:text-[#FF9BA7] disabled:cursor-not-allowed disabled:opacity-45"><CircleX className="size-4" />Dismiss</button><button type="button" onClick={() => void decideFinding(finding, "confirmed")} disabled={(reviewRationales[finding.id]?.trim().length ?? 0) < 3 || findingAction !== null} className="ui-label inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#58D6C7] px-3.5 py-2.5 text-[#07110F] transition hover:bg-[#76E2D5] disabled:cursor-not-allowed disabled:opacity-45"><CircleCheckBig className="size-4" />Confirm</button></div></div> : null}
                  {finding.reviewRationale ? <div className="mt-4 border-t border-white/[0.06] pt-4"><p className="ui-eyebrow text-[#7F8A9B]">Review rationale · {finding.reviewedBy}</p><p className="ui-meta mt-2 whitespace-pre-wrap text-[#C1C8D2]">{finding.reviewRationale}</p></div> : null}
                </article>)}
              </div>
            </motion.div>
          ) : (
            <CaseRelationships caseId={record.id} />
          )}
        </AnimatePresence>

        <aside className="h-fit min-w-0 rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#58D6C7]/[0.07] text-[#6CDDD0]"><Fingerprint className="size-5" /></span><div><h2 className="ui-section-title">Audit trail</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">{verificationLabel}</p></div></div><div className="mt-6 space-y-5 border-l border-white/[0.07] pl-5">{auditEvents.map((event) => <article key={event.id} className="relative before:absolute before:-left-[1.43rem] before:top-1.5 before:size-2 before:rounded-full before:bg-primary"><p className="ui-label">{auditLabel(event.action)} · #{event.ledgerSequence}</p><p className="ui-meta mt-1.5 truncate text-[#AAB3C1]">{event.actorId}</p><p className="ui-meta mt-3 font-mono text-[#8993A4]">{event.eventHash.slice(0, 16)}…</p></article>)}</div></aside>
      </div>
      <CasePrintSummary record={record} summary={findingSummary} findings={findings} />
      <CaseLifecycleDialog
        targetStatus={lifecycleTarget}
        busy={lifecycleBusy}
        error={lifecycleError}
        opener={lifecycleOpener}
        onClose={closeLifecycleDialog}
        onConfirm={() => void confirmLifecycleChange()}
      />
      <SourceDisposalDialog
        source={disposalSource}
        busy={disposalBusy}
        error={disposalError}
        opener={disposalOpener}
        onClose={closeDisposalDialog}
        onConfirm={() => void confirmSourceDisposal()}
      />
    </section>
  );
}
