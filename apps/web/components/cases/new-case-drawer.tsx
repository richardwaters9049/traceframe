"use client";

import { ShieldCheck, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";

import { CreateCaseForm } from "@/components/cases/create-case-form";

export function NewCaseDrawer({ open, onClose, opener }: { open: boolean; onClose: () => void; opener: HTMLElement | null }) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <Dialog.Portal>
      <Dialog.Backdrop
        className="fixed inset-0 z-40 cursor-pointer bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0"
      />
      <Dialog.Popup
        finalFocus={() => opener}
        className="fixed inset-y-0 right-0 z-50 grid w-full min-w-0 grid-rows-[auto_1fr] overflow-hidden border-l border-white/[0.08] bg-raised shadow-[-30px_0_90px_rgba(0,0,0,0.38)] transition-[opacity,transform] duration-300 ease-out data-ending-style:translate-x-12 data-ending-style:opacity-0 data-starting-style:translate-x-12 data-starting-style:opacity-0 sm:max-w-[38rem]"
      >
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-8">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#58D6C7]/20 bg-[#58D6C7]/[0.08] text-[#72E1D4]">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="ui-eyebrow text-[#8A97FF]">New investigation</p>
            <Dialog.Title id="new-case-title" className="ui-section-title mt-0.5 truncate text-foreground">Create a case</Dialog.Title>
          </div>
          <Dialog.Close
            className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-[#C8CED8] transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </Dialog.Close>
        </header>

        <div className="min-w-0 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-7 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-[#7C8DFF]/15 bg-primary/[0.055] p-4">
            <span className="mt-2 size-1.5 rounded-full bg-[#58D6C7] shadow-[0_0_10px_#58D6C7]" />
            <p className="ui-meta min-w-0 break-words text-[#AAB3C3] [overflow-wrap:anywhere]">
              A case and its first audit event are committed together as one secure record.
            </p>
          </div>
          <CreateCaseForm />
        </div>
      </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
