"use client";

import { useState, useTransition } from "react";
import { Sparkles, MessageSquareHeart } from "lucide-react";
import { structureCheckIn, type CheckInStructure } from "@/lib/ai/coach-actions";
import type { CheckIn } from "@/lib/data/checkins";

function Structured({ s }: { s: CheckInStructure }) {
  return (
    <div className="mt-3 rounded-xl border border-[color:var(--border-hair)] bg-inset/40 p-4">
      <p className="text-[14px] leading-[1.55] text-forest-deep">{s.summary}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {s.mood ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bark">Mood</p>
            <p className="text-[13.5px] text-[color:var(--color-text)]">{s.mood}</p>
          </div>
        ) : null}
        {s.focus ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bark">Focus</p>
            <p className="text-[13.5px] text-[color:var(--color-text)]">{s.focus}</p>
          </div>
        ) : null}
        {s.wins?.length ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bark">Wins</p>
            <ul className="list-disc pl-4 text-[13.5px] text-[color:var(--color-text)]">
              {s.wins.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {s.blockers?.length ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bark">In the way</p>
            <ul className="list-disc pl-4 text-[13.5px] text-[color:var(--color-text)]">
              {s.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-[color:var(--color-text-faint)]">
        Structured by Scout for you. A summary, not a medical assessment.
      </p>
    </div>
  );
}

function Row({ checkIn }: { checkIn: CheckIn }) {
  const [structured, setStructured] = useState<CheckInStructure | null>(
    (checkIn.structured as CheckInStructure | null) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await structureCheckIn(checkIn.id);
      if (res.error) setError(res.error);
      else setStructured(res.structured);
    });
  }

  return (
    <li className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
          {checkIn.kind === "voice" ? "Voice check-in" : "Check-in"} ·{" "}
          {new Date(checkIn.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        {!structured ? (
          <button
            type="button"
            onClick={run}
            disabled={pending || !checkIn.body}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-60"
          >
            <Sparkles size={13} aria-hidden="true" />
            {pending ? "Structuring" : "Structure with Scout"}
          </button>
        ) : null}
      </div>
      {checkIn.kind === "voice" && checkIn.voice_signed_url ? (
        <audio
          controls
          src={checkIn.voice_signed_url}
          className="mt-2 h-9 w-full"
          preload="none"
        />
      ) : null}
      {checkIn.body ? (
        <p className="mt-2 text-[14px] leading-[1.55] text-[color:var(--color-text)]">
          {checkIn.kind === "voice" ? (
            <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-text-faint)]">
              Transcript
            </span>
          ) : null}
          {checkIn.body}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}
      {structured ? <Structured s={structured} /> : null}
    </li>
  );
}

export function CheckInsReview({ checkIns }: { checkIns: CheckIn[] }) {
  if (checkIns.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquareHeart size={17} className="text-forest" aria-hidden="true" />
        <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
          Check-ins
        </h2>
      </div>
      <ul className="flex flex-col gap-3">
        {checkIns.map((c) => (
          <Row key={c.id} checkIn={c} />
        ))}
      </ul>
    </section>
  );
}
