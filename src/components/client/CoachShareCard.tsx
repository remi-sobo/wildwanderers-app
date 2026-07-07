"use client";

import { useState, useTransition } from "react";
import { Heart, Dumbbell } from "lucide-react";
import { toggleAck } from "@/lib/coach-shares/actions";
import type { FeedShare } from "@/lib/data/coach-shares";

const TONE_LABEL: Record<string, string> = {
  note: "A note",
  training: "Training",
  lesson: "A lesson",
  win: "A win",
  tough_day: "A tough day",
};

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function CoachShareCard({ share, coachName }: { share: FeedShare; coachName?: string }) {
  const [acked, setAcked] = useState(share.acked);
  const [count, setCount] = useState(share.ack_count);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAck() {
    setError(null);
    const nextAcked = !acked;
    // Optimistic: settle the button and count, roll back on failure.
    setAcked(nextAcked);
    setCount((c) => c + (nextAcked ? 1 : -1));
    start(async () => {
      const res = await toggleAck(share.id);
      if (!res.ok) {
        setAcked(!nextAcked);
        setCount((c) => c + (nextAcked ? -1 : 1));
        setError(res.error);
      } else {
        setAcked(res.acked);
      }
    });
  }

  return (
    <article className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-forest/8 px-2.5 py-0.5 text-[11.5px] font-semibold text-forest">
          {TONE_LABEL[share.tone] ?? "A note"}
        </span>
        <span className="text-[11.5px] text-[color:var(--color-text-faint)]">
          {coachName ? `${coachName} · ` : ""}
          {when(share.published_at)}
        </span>
      </div>

      {share.title ? (
        <h3 className="mt-2.5 font-[family-name:var(--font-display)] text-[18px] leading-snug text-forest-deep">
          {share.title}
        </h3>
      ) : null}

      <p className="mt-2 whitespace-pre-line text-[14.5px] leading-[1.6] text-[color:var(--color-text)]">
        {share.body}
      </p>

      {share.training_note ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-inset px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--color-text-muted)]">
          <Dumbbell size={13} aria-hidden="true" />
          {share.training_note}
        </p>
      ) : null}

      {share.media_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={share.media_url}
          alt=""
          className="mt-3 max-h-80 w-full rounded-xl object-cover"
        />
      ) : null}

      <div className="mt-4 flex items-center gap-3 border-t border-[color:var(--border-hair)] pt-3.5">
        <button
          type="button"
          onClick={onAck}
          disabled={pending}
          aria-pressed={acked}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-60 max-md:min-h-[44px] ${
            acked
              ? "border-fern/40 bg-fern/10 text-forest-deep"
              : "border-[color:var(--border-strong)] text-forest hover:bg-forest/5"
          }`}
        >
          <Heart size={14} fill={acked ? "currentColor" : "none"} aria-hidden="true" />
          {acked ? "Walking with you" : "I'm with you"}
        </button>
        {count > 0 ? (
          <span className="text-[12.5px] text-[color:var(--color-text-muted)]">
            {count} walking with {coachName ?? "your coach"}
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}
    </article>
  );
}
