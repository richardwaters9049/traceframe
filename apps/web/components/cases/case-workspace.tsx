"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, Clock3, Database, Eye, FileText, Fingerprint,
  LoaderCircle, RefreshCw, Upload, X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { CaseWorkspaceRecord } from "@/components/cases/workspace-content";
import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import { apiRequest } from "@/lib/http/client";
import type { SourceRecord } from "@/lib/sources/contracts";

type WorkspaceTab = "analysis" | "sources";

function statusStyles(status: SourceRecord["status"]) {
  if (status === "ready") return "bg-[#58D6C7]/10 text-[#76E2D5] ring-[#58D6C7]/20";
  if (status === "failed") return "bg-[#FF7D8D]/10 text-[#FF9BA7] ring-[#FF7D8D]/20";
  return "bg-primary/10 text-[#9AA7FF] ring-primary/20";
}

function readableBytes(value: number) {
  return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KiB`;
}

export function CaseWorkspace({ workspace }: { workspace: CaseWorkspaceRecord }) {
  const { showDashboard } = useWorkspaceUI();
  const [tab, setTab] = useState<WorkspaceTab>(workspace.sources.length ? "sources" : "analysis");
  const [sources, setSources] = useState(workspace.sources);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { case: record, auditEvents } = workspace;
  const createdAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt));
  const verificationLabel = workspace.verification.status === "verified"
    ? "Global ledger verified"
    : workspace.verification.status === "broken" ? "Ledger integrity failed" : "Verification unavailable";
  const processing = sources.some((source) => source.status === "queued" || source.status === "processing");

  useEffect(() => {
    if (!processing) return;
    const controller = new AbortController();
    const refresh = async () => {
      const result = await apiRequest<{ sources: SourceRecord[] }>(
        `/api/cases/${encodeURIComponent(record.id)}/sources`, { signal: controller.signal }, 5_000,
      );
      if (result.ok) setSources(result.data.sources);
    };
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [processing, record.id]);

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
      const refreshed = await apiRequest<{ sources: SourceRecord[] }>(`/api/cases/${encodeURIComponent(record.id)}/sources`);
      if (refreshed.ok) setSources(refreshed.data.sources);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage({ tone: "success", text: "Source secured and queued for analysis." });
    } else {
      setMessage({ tone: "error", text: result.error });
    }
    setUploading(false);
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <button type="button" onClick={showDashboard} className="ui-label inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.09] bg-primary px-3.5 py-2 text-background transition hover:bg-primary-hover hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><ArrowLeft className="size-4" />Back to dashboard</button>
      <div className="mt-7 flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
        <div className="max-w-3xl"><div className="ui-eyebrow flex items-center gap-2"><span className="rounded-full bg-[#58D6C7]/[0.08] px-2.5 py-1 text-[#72DFD2] ring-1 ring-inset ring-[#58D6C7]/15">{record.status}</span><span className="rounded-full bg-white/[0.045] px-2.5 py-1 text-[#B3BBC8] ring-1 ring-inset ring-white/[0.07]">{record.priority}</span></div><h1 className="ui-page-title mt-4 text-balance">{record.title}</h1><p className="ui-body mt-4 max-w-2xl whitespace-pre-wrap text-[#B4BDCA]">{record.summary || "No initial context was recorded for this case."}</p></div>
        <span className="ui-meta inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[#AEB7C5]"><Clock3 className="size-4 text-[#8594FF]" />{createdAt}</span>
      </div>

      <div role="tablist" aria-label="Case workspace" className="ui-label mt-10 flex gap-7 border-b border-white/[0.065] text-[#98A2B2]">
        {(["analysis", "sources"] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} type="button" onClick={() => setTab(value)} className={`cursor-pointer border-b-2 pb-3 capitalize transition ${tab === value ? "border-[#7C8DFF] text-[#E3E7ED]" : "border-transparent hover:text-white"}`}>{value}{value === "sources" && sources.length ? ` · ${sources.length}` : ""}</button>)}
        <button disabled title="Relationships are not available yet" className="cursor-not-allowed border-b-2 border-transparent pb-3 opacity-45">Relationships</button>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "analysis" ? (
            <motion.div key="analysis" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="min-h-[28rem] min-w-0 rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5 sm:p-7">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]"><FileText className="size-5" /></span><div><h2 className="ui-section-title">Analysis workspace</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">{sources.length ? `${sources.length} source${sources.length === 1 ? "" : "s"} attached` : "Case established"}</p></div></div>
              <div className="mt-7 grid min-h-[20rem] place-items-center rounded-2xl border border-dashed border-white/[0.075] bg-white/[0.012] p-8 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-[#58D6C7]/[0.06] text-[#69DCCE]"><Check className="size-5" /></span><h3 className="ui-section-title mt-4">{sources.length ? "Evidence pipeline active" : "Ready for source material"}</h3><p className="ui-meta mt-2 max-w-md text-[#AAB3C1]">{sources.length ? "Open Sources to inspect provenance, processing health, and derived indicators." : "Add a small synthetic text source to begin the evidence-led workflow."}</p>{!sources.length ? <button type="button" onClick={() => setTab("sources")} className="ui-label mt-5 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-background transition hover:bg-primary-hover hover:text-white">Add first source</button> : null}</div></div>
            </motion.div>
          ) : (
            <motion.div key="sources" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="min-h-[28rem] min-w-0 rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]"><Database className="size-5" /></span><div><h2 className="ui-section-title">Source material</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">Originals secured · analysis derived</p></div></div>{processing ? <span className="ui-meta inline-flex items-center gap-2 text-[#9AA7FF]"><RefreshCw className="size-4 animate-spin" />Processing updates live</span> : null}</div>

              <form onSubmit={uploadSource} className="mt-6 rounded-2xl border border-dashed border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center"><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0D1118] px-4 py-3 transition hover:border-primary/35"><Upload className="size-5 shrink-0 text-[#8796FF]" /><span className="min-w-0"><span className="ui-label block truncate text-[#DDE2EA]">{selectedFile?.name ?? "Choose synthetic source"}</span><span className="ui-meta mt-0.5 block text-[#9FA9B8]">UTF-8 TXT, LOG, CSV or JSON · 1 MiB maximum</span></span><input ref={inputRef} type="file" name="file" accept=".txt,.log,.csv,.json,text/plain,text/csv,application/json" className="sr-only" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setMessage(null); }} /></label><button type="submit" disabled={!selectedFile || uploading} className="ui-label inline-flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-background transition hover:bg-primary-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-45">{uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{uploading ? "Securing…" : "Upload"}</button></div>
                {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`ui-meta mt-3 flex items-center gap-2 ${message.tone === "error" ? "text-[#FF9BA7]" : "text-[#76E2D5]"}`}>{message.tone === "error" ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}{message.text}</p> : null}
              </form>

              <div className="mt-5 space-y-3">
                {!sources.length ? <div className="grid min-h-48 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.012] p-8 text-center"><div><Eye className="mx-auto size-6 text-[#7484F4]" /><p className="ui-section-title mt-3">No source material yet</p><p className="ui-meta mt-2 text-[#AAB3C1]">The original stays in object storage; only provenance and derived analysis appear here.</p></div></div> : null}
                {sources.map((source) => <article key={source.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="ui-section-title truncate">{source.originalFilename}</p><p className="ui-meta mt-1 text-[#AAB3C1]">{readableBytes(source.sizeBytes)} · {source.mediaType} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.createdAt))}</p></div><span className={`ui-eyebrow inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${statusStyles(source.status)}`}>{source.status === "queued" || source.status === "processing" ? <LoaderCircle className="size-3.5 animate-spin" /> : source.status === "ready" ? <Check className="size-3.5" /> : <X className="size-3.5" />}{source.status}</span></div><p className="ui-meta mt-3 truncate font-mono text-[#8993A4]" title={source.sha256}>SHA-256 {source.sha256}</p>{source.status === "ready" ? <><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/[0.025] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Characters</p><p className="ui-section-title mt-1">{source.characterCount}</p></div><div className="rounded-xl bg-white/[0.025] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Lines</p><p className="ui-section-title mt-1">{source.lineCount}</p></div><div className="rounded-xl bg-white/[0.025] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Words</p><p className="ui-section-title mt-1">{source.wordCount}</p></div></div>{source.observations.length ? <div className="mt-4 flex flex-wrap gap-2">{source.observations.map((observation) => <span key={observation.id} className="ui-meta max-w-full truncate rounded-lg bg-[#58D6C7]/[0.055] px-2.5 py-1.5 text-[#8FDCD3] ring-1 ring-inset ring-[#58D6C7]/10">{observation.kind.toUpperCase()} · {observation.value}{observation.occurrences > 1 ? ` ×${observation.occurrences}` : ""}</span>)}</div> : <p className="ui-meta mt-4 text-[#9FA9B8]">No email, URL, or IPv4 indicators were derived.</p>}</> : null}{source.failureReason ? <p role="alert" className="ui-meta mt-3 text-[#FF9BA7]">{source.failureReason}</p> : null}</article>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <aside className="h-fit rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#58D6C7]/[0.07] text-[#6CDDD0]"><Fingerprint className="size-5" /></span><div><h2 className="ui-section-title">Audit trail</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">{verificationLabel}</p></div></div><div className="mt-6 space-y-5 border-l border-white/[0.07] pl-5">{auditEvents.map((event) => <article key={event.id} className="relative before:absolute before:-left-[1.43rem] before:top-1.5 before:size-2 before:rounded-full before:bg-primary"><p className="ui-label">{event.action === "source.uploaded" ? "Source uploaded" : "Case created"} · #{event.ledgerSequence}</p><p className="ui-meta mt-1.5 truncate text-[#AAB3C1]">{event.actorId}</p><p className="ui-meta mt-3 font-mono text-[#8993A4]">{event.eventHash.slice(0, 16)}…</p></article>)}</div></aside>
      </div>
    </section>
  );
}
