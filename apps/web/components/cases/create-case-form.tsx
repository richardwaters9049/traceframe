"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspaceUI } from "@/components/cases/workspace-ui-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CreateCaseResponse = {
  case?: { id: string };
  error?: string;
  issues?: Array<{ field: string; message: string }>;
};

export function CreateCaseForm() {
  const router = useRouter();
  const { closeNewCase, showDashboard } = useWorkspaceUI();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          summary: form.get("summary"),
          priority: form.get("priority"),
        }),
      });
      const result = (await response.json()) as CreateCaseResponse;

      if (!response.ok || !result.case) {
        const fieldIssue = result.issues?.[0]?.message;
        setError(fieldIssue ?? result.error ?? "The case could not be created.");
        return;
      }

      closeNewCase();
      showDashboard();
      router.refresh();
    } catch {
      setError("Traceframe could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08, duration: 0.4, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="title" className="ui-label text-[#C5CBD5]">
            Case title
          </Label>
          <Input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={120}
            autoFocus
            placeholder="Unusual authentication activity"
            className="h-12 rounded-xl border-white/[0.09] bg-white/[0.035] px-4 tracking-[0.025em] text-[#F4F6F9] placeholder:text-[#525A6A] focus-visible:border-[#7C8DFF]/60 focus-visible:ring-[#7C8DFF]/15"
          />
          <p className="ui-meta text-[#70798B]">
            Use a neutral, observable description rather than a conclusion.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="summary" className="ui-label text-[#C5CBD5]">
            Initial context
          </Label>
          <Textarea
            id="summary"
            name="summary"
            maxLength={2000}
            rows={6}
            placeholder="Record what prompted the case, what is currently known, and any immediate constraints."
            className="resize-none rounded-xl border-white/[0.09] bg-white/[0.035] p-4 tracking-[0.025em] text-[#F4F6F9] placeholder:text-[#525A6A] focus-visible:border-[#7C8DFF]/60 focus-visible:ring-[#7C8DFF]/15"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="priority" className="ui-label text-[#C5CBD5]">
            Priority
          </Label>
          <select
            id="priority"
            name="priority"
            defaultValue="standard"
            className="h-12 rounded-xl border border-white/[0.09] bg-[#12161E] px-3 text-sm tracking-[0.025em] text-[#E8EBF1] outline-none focus:border-[#7C8DFF]/60 focus:ring-3 focus:ring-[#7C8DFF]/15"
          >
            <option value="standard">Standard — routine triage</option>
            <option value="high">High — time-sensitive review</option>
            <option value="critical">Critical — immediate attention</option>
          </select>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-300/15 bg-red-300/[0.07] px-4 py-3 text-sm tracking-[0.02em] text-red-200">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 rounded-xl bg-[#7C8DFF] text-sm font-semibold tracking-[0.035em] text-[#090B10] hover:bg-[#93A1FF] disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Creating secure record…
            </>
          ) : (
            <>
              Create case
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </motion.form>
  );
}
