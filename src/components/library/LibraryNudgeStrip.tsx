import Link from "next/link";
import { PenLine } from "lucide-react";
import type { Cadence } from "@/lib/data/library";

// A slim, dismissible-feeling prompt for the Program landing. Only appears when
// a trail note is actually due, so it is a nudge, not noise. Owner only; the
// caller decides who sees it.
export function LibraryNudgeStrip({ cadence }: { cadence: Cadence }) {
  if (cadence.postedThisWeek) return null;

  const line = !cadence.everPublished
    ? "Open the Trailhead Library with your first trail note."
    : `It has been ${cadence.daysSince ?? 0} days since your last trail note.`;

  return (
    <Link
      href="/library/new"
      className="group flex items-center gap-3 rounded-xl border border-amber/30 bg-amber/[0.06] px-4 py-3 transition-colors hover:bg-amber/10"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber-deep">
        <PenLine size={15} aria-hidden="true" />
      </span>
      <p className="flex-1 text-[13.5px] text-ink">{line}</p>
      <span className="text-[13px] font-semibold text-amber-deep transition-transform group-hover:translate-x-0.5">
        New post &rarr;
      </span>
    </Link>
  );
}
