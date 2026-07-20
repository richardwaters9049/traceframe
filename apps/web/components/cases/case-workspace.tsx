"use client";

import { ArrowLeft, Check, Clock3, FileText, Fingerprint } from "lucide-react";

import type { CaseWorkspaceRecord } from "@/components/cases/workspace-content";
import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";

export function CaseWorkspace({ workspace }: { workspace: CaseWorkspaceRecord }) {
  const { showDashboard } = useWorkspaceUI();
  const { case: record, auditEvents } = workspace;
  const createdAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt));
  const verificationLabel = workspace.verification.status === "verified"
    ? "Global ledger verified"
    : workspace.verification.status === "broken" ? "Ledger integrity failed" : "Verification unavailable";

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <button type="button" onClick={showDashboard} className="ui-label inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-2 text-[#D2D7E0] hover:bg-white/[0.075]"><ArrowLeft className="size-4" />Back to dashboard</button>
      <div className="mt-7 flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
        <div className="max-w-3xl"><div className="ui-eyebrow flex items-center gap-2"><span className="rounded-full bg-[#58D6C7]/[0.08] px-2.5 py-1 text-[#72DFD2] ring-1 ring-inset ring-[#58D6C7]/15">{record.status}</span><span className="rounded-full bg-white/[0.045] px-2.5 py-1 text-[#B3BBC8] ring-1 ring-inset ring-white/[0.07]">{record.priority}</span></div><h1 className="ui-page-title mt-4 text-balance">{record.title}</h1><p className="ui-body mt-4 max-w-2xl whitespace-pre-wrap text-[#B4BDCA]">{record.summary || "No initial context was recorded for this case."}</p></div>
        <span className="ui-meta inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[#AEB7C5]"><Clock3 className="size-4 text-[#8594FF]" />{createdAt}</span>
      </div>
      <div className="ui-label mt-10 flex gap-7 border-b border-white/[0.065] text-[#98A2B2]"><button className="border-b-2 border-[#7C8DFF] pb-3 text-[#E3E7ED]">Analysis</button><button disabled title="Sources will be available with evidence ingestion" className="pb-3 opacity-45">Sources</button><button disabled title="Relationships are not available yet" className="pb-3 opacity-45">Relationships</button></div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-[28rem] rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]"><FileText className="size-5" /></span><div><h2 className="ui-section-title">Analysis workspace</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">Case established</p></div></div><div className="mt-7 grid min-h-[20rem] place-items-center rounded-2xl border border-dashed border-white/[0.075] bg-white/[0.012] p-8 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-[#58D6C7]/[0.06] text-[#69DCCE]"><Check className="size-5" /></span><h3 className="ui-section-title mt-4">Ready for source material</h3><p className="ui-meta mt-2 text-[#AAB3C1]">Evidence ingestion will appear here.</p></div></div></div>
        <aside className="h-fit rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#58D6C7]/[0.07] text-[#6CDDD0]"><Fingerprint className="size-5" /></span><div><h2 className="ui-section-title">Audit trail</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">{verificationLabel}</p></div></div><div className="mt-6 space-y-5 border-l border-white/[0.07] pl-5">{auditEvents.map((event) => <article key={event.id} className="relative before:absolute before:-left-[1.43rem] before:top-1.5 before:size-2 before:rounded-full before:bg-primary"><p className="ui-label">Case created · #{event.ledgerSequence}</p><p className="ui-meta mt-1.5 truncate text-[#AAB3C1]">{event.actorId}</p><p className="ui-meta mt-3 font-mono text-[#8993A4]">{event.eventHash.slice(0, 16)}…</p></article>)}</div></aside>
      </div>
    </section>
  );
}
