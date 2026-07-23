"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle, RotateCcw, X } from "lucide-react";

import type { SourceRecord } from "@/lib/sources/contracts";

export function SourceIngestionRetryDialog({
  source,
  busy,
  error,
  opener,
  onClose,
  onConfirm,
}: {
  source: SourceRecord | null;
  busy: boolean;
  error: string | null;
  opener: HTMLElement | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root
      open={source !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 cursor-pointer bg-black/65 backdrop-blur-[3px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          finalFocus={() => opener}
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-white/[0.09] bg-raised p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-[#9AA7FF]">
              <RotateCcw className="size-5" aria-hidden="true" />
            </span>
            <button
              type="button"
              aria-label="Close ingestion retry confirmation"
              disabled={busy}
              onClick={onClose}
              className="grid size-9 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#B8C0CB] transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <Dialog.Title className="ui-section-title mt-5 text-foreground">
            Retry source ingestion?
          </Dialog.Title>
          <Dialog.Description className="ui-meta mt-3 text-[#B4BDCA]">
            This resets the terminal attempt counter and queues the retained original for the
            worker. Provenance stays unchanged, and successful analysis replaces the failed state.
          </Dialog.Description>
          {source ? (
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
              <p className="ui-label truncate text-[#D8DEE7]">{source.originalFilename}</p>
              <p className="ui-meta mt-1 text-[#919CAB]">
                {source.ingestion.attempts} of {source.ingestion.maxAttempts} attempts used
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="ui-meta mt-4 rounded-xl border border-[#FF7D8D]/15 bg-[#FF7D8D]/[0.06] px-3.5 py-3 text-[#FFABB5]">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={onClose}
              className="ui-label cursor-pointer rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-2.5 text-[#C3CAD4] transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="ui-label inline-flex min-w-36 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-background transition hover:bg-primary-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {busy ? "Requeuing…" : "Retry ingestion"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
