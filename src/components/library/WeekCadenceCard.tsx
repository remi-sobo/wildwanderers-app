import Link from "next/link";
import { PenLine, Check } from "lucide-react";
import { Ridgeline } from "@/components/brand/Ridgeline";
import type { Cadence } from "@/lib/data/library";

// The weekly rhythm nudge. Gentle, never a scold, and built on real dates only.
// Three honest states: posted this week, overdue, or nothing published yet.
export function WeekCadenceCard({ cadence }: { cadence: Cadence }) {
  const posted = cadence.postedThisWeek;

  let eyebrow: string;
  let line: string;
  if (!cadence.everPublished) {
    eyebrow = "The library is open";
    line = "Publish your first trail note and it shows up here, in the app and on the site.";
  } else if (posted) {
    eyebrow = "This week";
    line = "You have posted a trail note this week. Nice. Add another anytime.";
  } else {
    const d = cadence.daysSince ?? 0;
    eyebrow = "This week";
    line = `It has been ${d} ${d === 1 ? "day" : "days"} since your last trail note. A short one keeps the trail warm.`;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-chrome px-6 py-6 text-bone shadow-[var(--shadow-card)]">
      <Ridgeline className="pointer-events-none absolute inset-x-0 bottom-0 text-mist/10" />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              posted ? "bg-fern/20 text-fern" : "bg-bone/10 text-cream"
            }`}
          >
            {posted ? <Check size={18} aria-hidden="true" /> : <PenLine size={17} aria-hidden="true" />}
          </span>
          <div>
            <p className="eyebrow text-bone/55">{eyebrow}</p>
            <p className="mt-1 max-w-md text-[14.5px] leading-[1.5] text-bone/90">{line}</p>
          </div>
        </div>
        <Link
          href="/library/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-5 py-2.5 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep max-md:min-h-[44px]"
        >
          <PenLine size={15} aria-hidden="true" />
          New post
        </Link>
      </div>
    </div>
  );
}
