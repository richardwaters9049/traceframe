"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, Network, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

import type { CaseCorrelationCollection } from "@/lib/correlations/contracts";
import { apiRequest } from "@/lib/http/client";

export function CaseRelationships({ caseId }: { caseId: string }) {
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<{
    collection: CaseCorrelationCollection | null;
    error: string | null;
    loading: boolean;
  }>({ collection: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<CaseCorrelationCollection>(
      `/api/cases/${encodeURIComponent(caseId)}/correlations`,
      { signal: controller.signal },
    ).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.ok
        ? { collection: result.data, error: null, loading: false }
        : { collection: null, error: result.error, loading: false });
    });
    return () => controller.abort();
  }, [caseId, requestVersion]);

  const collection = state.collection;

  return (
    <motion.div key="relationships" role="tabpanel" aria-label="Relationships" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="min-h-[28rem] min-w-0 rounded-[1.5rem] border border-white/[0.07] bg-navigation p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-[#91A0FF]"><Network className="size-5" /></span><div><h2 className="ui-section-title">Cross-source relationships</h2><p className="ui-eyebrow mt-1 text-[#8F99AA]">Repeated indicators · bounded view</p></div></div>
        {collection ? <p className="ui-meta text-[#AAB3C1]">Top {collection.limits.correlations} maximum</p> : null}
      </div>

      {state.loading ? <div className="grid min-h-72 place-items-center"><p role="status" className="ui-meta inline-flex items-center gap-2 text-[#AAB3C1]"><LoaderCircle className="size-4 animate-spin text-[#8B99FF]" />Correlating ready sources…</p></div> : null}

      {state.error ? <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-[#FF7D8D]/15 bg-[#FF7D8D]/[0.035] p-6 text-center"><div><AlertTriangle className="mx-auto size-6 text-[#FF9BA7]" /><p role="alert" className="ui-section-title mt-3">Relationships unavailable</p><p className="ui-meta mt-2 text-[#B8C0CB]">{state.error}</p><button type="button" onClick={() => { setState({ collection: null, error: null, loading: true }); setRequestVersion((value) => value + 1); }} className="ui-label mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.1] px-3.5 py-2.5 text-[#D6DCE4] transition hover:border-primary/35 hover:text-white"><RefreshCw className="size-4" />Try again</button></div></div> : null}

      {collection ? <>
        <div aria-label="Relationship summary" className="mt-6 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.055] bg-white/[0.02] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Repeated indicators</p><p className="ui-section-title mt-1 tabular-nums">{collection.summary.total}</p></div>
          <div className="rounded-xl border border-white/[0.055] bg-white/[0.02] p-3"><p className="ui-eyebrow text-[#7F8A9B]">Source links</p><p className="ui-section-title mt-1 tabular-nums">{collection.summary.sourceLinks}</p></div>
        </div>

        <div className="mt-5 space-y-3">
          {!collection.correlations.length ? <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/[0.075] bg-white/[0.012] p-8 text-center"><div><Network className="mx-auto size-6 text-[#7484F4]" /><p className="ui-section-title mt-3">No repeated indicators yet</p><p className="ui-meta mt-2 max-w-md text-[#AAB3C1]">A relationship appears when the same normalised indicator is observed in at least two ready sources.</p></div></div> : null}
          {collection.correlations.map((correlation) => <article key={`${correlation.kind}:${correlation.value}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="ui-eyebrow text-[#8F99AA]">{correlation.kind}</p><p className="ui-section-title mt-1 break-all">{correlation.value}</p></div><span className="ui-eyebrow inline-flex w-fit shrink-0 rounded-full bg-[#58D6C7]/10 px-2.5 py-1 text-[#76E2D5] ring-1 ring-inset ring-[#58D6C7]/20">{correlation.sourceCount} sources · {correlation.totalOccurrences} hits</span></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{correlation.sources.map((source) => <div key={source.sourceId} className="min-w-0 rounded-xl bg-white/[0.025] px-3 py-2.5"><p className="ui-meta truncate text-[#C1C8D2]" title={source.sourceFilename}>{source.sourceFilename}</p><p className="ui-eyebrow mt-1 text-[#7F8A9B]">{source.occurrences} occurrence{source.occurrences === 1 ? "" : "s"}</p></div>)}</div>
            {correlation.sourcesTruncated ? <p className="ui-meta mt-3 text-[#8F99AA]">Showing the first {collection.limits.sourcesPerCorrelation} source records.</p> : null}
          </article>)}
        </div>
      </> : null}
    </motion.div>
  );
}
