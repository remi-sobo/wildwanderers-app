"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { suggestSwap } from "@/lib/plans/talk-actions";
import type { LibraryItem } from "@/lib/data/exercises";

// The coach suggests a replacement for one exercise on a client's plan.
// Nothing changes until the client accepts it on Training.
export function SuggestSwap({
  planId,
  exerciseId,
  exerciseTitle,
  library,
  revalidate,
}: {
  planId: string;
  exerciseId: string;
  exerciseTitle: string;
  library: LibraryItem[];
  revalidate: string;
}) {
  const [open, setOpen] = useState(false);
  const [libraryItemId, setLibraryItemId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const item = library.find((l) => l.id === libraryItemId);
    if (!item) {
      setError("Pick the movement to suggest.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await suggestSwap(
        planId,
        exerciseId,
        {
          libraryItemId: item.id,
          title: item.title,
          sets: item.default_sets != null ? String(item.default_sets) : "",
          reps: item.default_reps ?? "",
          load: "",
          reason,
        },
        revalidate,
      );
      if (result.error) setError(result.error);
      else {
        setSent(true);
        setOpen(false);
      }
    });
  }

  if (sent) {
    return (
      <span className="text-[11.5px] font-semibold text-forest">Suggested</span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Suggest a swap for ${exerciseTitle}`}
        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[color:var(--color-text-faint)] transition-colors hover:text-forest max-md:min-h-[44px]"
      >
        <ArrowLeftRight size={12} aria-hidden="true" />
        Swap
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[290px] flex-col gap-2 rounded-xl border border-[color:var(--border-strong)] bg-card p-3 shadow-[0_12px_30px_rgba(42,33,24,.16)]">
          <p className="text-[12px] font-semibold text-bark">
            In place of {exerciseTitle}
          </p>
          <select
            value={libraryItemId}
            onChange={(e) => setLibraryItemId(e.target.value)}
            aria-label="Suggested movement"
            className="h-11 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[16px] text-ink md:h-10 md:text-[13px]"
          >
            <option value="">Pick a movement</option>
            {library.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why (optional, they will see it)"
            className="h-11 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[16px] text-ink md:h-10 md:text-[13px]"
          />
          {error ? (
            <p role="alert" className="text-[12px] text-[color:var(--color-state-error)]">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-full bg-amber px-3.5 py-1.5 text-[12.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-60 max-md:min-h-[44px]"
            >
              {pending ? "Sending" : "Suggest it"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center px-2 text-[12px] font-semibold text-[color:var(--color-text-muted)] max-md:min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
