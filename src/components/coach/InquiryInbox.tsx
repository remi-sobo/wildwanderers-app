"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock } from "lucide-react";
import { acceptInquiry, dismissInquiry } from "@/lib/business/inquiry-actions";
import type { LeadInquiry } from "@/lib/data/business";

const INTEREST_LABEL: Record<string, string> = {
  one_on_one: "One-on-one training",
  small_group: "Small-group training",
  wellness: "Wellness coaching",
  boys_program: "Boys program",
  other: "Other",
};

const TRUNCATE_AT = 140;

// How long ago it arrived. The age is the urgency cue, so it reads plainly.
function age(createdAt: string): { label: string; stale: boolean } {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (mins < 1) return { label: "just now", stale: false };
  if (mins < 60) return { label: `${mins} min ago`, stale: false };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { label: `${hrs} hr ago`, stale: hrs >= 4 };
  const days = Math.floor(hrs / 24);
  return { label: `${days} ${days === 1 ? "day" : "days"} ago`, stale: true };
}

function InquiryCard({
  inquiry: q,
  onAccepted,
}: {
  inquiry: LeadInquiry;
  onAccepted: (leadId: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = age(q.created_at);
  const long = (q.message?.length ?? 0) > TRUNCATE_AT;
  const shown = q.message && long && !expanded ? `${q.message.slice(0, TRUNCATE_AT).trimEnd()}…` : q.message;

  function accept() {
    setError(null);
    start(async () => {
      const res = await acceptInquiry(q.id);
      if (res.error) setError(res.error);
      else {
        router.refresh();
        if (res.leadId) onAccepted(res.leadId);
      }
    });
  }

  function dismiss() {
    setError(null);
    start(async () => {
      const res = await dismissInquiry(q.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex flex-col rounded-xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold text-forest-deep">{q.name}</p>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            {INTEREST_LABEL[q.interest] ?? q.interest}
          </p>
        </div>
        <span
          suppressHydrationWarning
          className={`inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold ${
            a.stale ? "text-[color:var(--color-state-caution)]" : "text-fern"
          }`}
        >
          <Clock size={12} aria-hidden="true" />
          {a.label}
        </span>
      </div>

      {shown ? (
        <p className="mt-2 whitespace-pre-line text-[13.5px] leading-[1.5] text-[color:var(--color-text)]">
          {shown}
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ww-link ml-1 text-[12.5px] font-semibold text-forest"
            >
              {expanded ? "Less" : "More"}
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[color:var(--color-text-muted)]">
        {q.preferred_times?.length ? <span>Usually free: {q.preferred_times.join(", ")}</span> : null}
        {q.phone ? <span>{q.phone}</span> : null}
        {q.email ? <span className="truncate">{q.email}</span> : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-[color:var(--color-state-error)]">{error}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={accept}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
        >
          <Check size={15} strokeWidth={2.4} aria-hidden="true" />
          {pending ? "Working" : "Accept"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="ww-link inline-flex items-center gap-1 text-[13.5px] font-semibold text-[color:var(--color-text-muted)] disabled:opacity-70 max-md:min-h-[44px]"
        >
          <X size={14} aria-hidden="true" /> Dismiss
        </button>
      </div>
    </li>
  );
}

// The speed-to-lead inbox. Shows only while new website inquiries wait;
// oldest first, since the oldest is the most urgent. Accept makes the lead
// and opens it; dismiss leaves nothing behind on the board.
export function InquiryInbox({
  inquiries,
  onAccepted,
}: {
  inquiries: LeadInquiry[];
  onAccepted: (leadId: string) => void;
}) {
  if (inquiries.length === 0) return null;
  return (
    <section aria-labelledby="inquiries-heading">
      <h2
        id="inquiries-heading"
        className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-amber-deep"
      >
        Inquiries <span className="text-[color:var(--color-text-faint)]">· {inquiries.length}</span>
      </h2>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {inquiries.map((q) => (
          <InquiryCard key={q.id} inquiry={q} onAccepted={onAccepted} />
        ))}
      </ul>
    </section>
  );
}
