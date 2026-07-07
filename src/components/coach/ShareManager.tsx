"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Heart, Eye, EyeOff } from "lucide-react";
import { setSharePublished, deleteShare } from "@/lib/coach-shares/actions";
import type { CoachShare } from "@/lib/data/coach-shares";

const TONE_LABEL: Record<string, string> = {
  note: "Note",
  training: "Training",
  lesson: "Lesson",
  win: "Win",
  tough_day: "Tough day",
};

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ShareManager({
  shares,
  cadence,
}: {
  shares: CoachShare[];
  cadence: { total: number; weekStreak: number };
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePublish(s: CoachShare) {
    setError(null);
    setBusyId(s.id);
    start(async () => {
      const res = await setSharePublished(s.id, s.status !== "published");
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function remove(s: CoachShare) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    setError(null);
    setBusyId(s.id);
    start(async () => {
      const res = await deleteShare(s.id);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {cadence.weekStreak > 0 ? (
        <p className="rounded-xl bg-forest/5 px-4 py-3 text-[13.5px] text-forest-deep">
          You have shared {cadence.weekStreak}{" "}
          {cadence.weekStreak === 1 ? "week" : "weeks"} running. Leading by showing.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] text-[color:var(--color-state-error)]"
        >
          {error}
        </p>
      ) : null}

      {shares.length === 0 ? (
        <p className="rounded-xl bg-inset/60 px-4 py-6 text-center text-[13.5px] text-[color:var(--color-text-muted)]">
          No notes yet. Share how your week is going, and your people will see it.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shares.map((s) => {
            const published = s.status === "published";
            return (
              <li
                key={s.id}
                className="flex items-start gap-3 rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-inset px-2.5 py-0.5 text-[11.5px] font-semibold text-[color:var(--color-text-muted)]">
                      {TONE_LABEL[s.tone] ?? s.tone}
                    </span>
                    {!published ? (
                      <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-deep">
                        Draft
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-[color:var(--color-text-faint)]">
                        {when(s.published_at)}
                        {s.audience === "clients" ? " · clients only" : ""}
                      </span>
                    )}
                    {published && s.ack_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-fern">
                        <Heart size={12} aria-hidden="true" /> {s.ack_count}
                      </span>
                    ) : null}
                  </div>
                  {s.title ? (
                    <p className="mt-1.5 font-[family-name:var(--font-display)] text-[15px] text-ink">
                      {s.title}
                    </p>
                  ) : null}
                  <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
                    {s.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/alongside/${s.id}/edit`}
                    aria-label="Edit note"
                    className="rounded-lg p-2 text-[color:var(--color-text-muted)] transition-colors hover:bg-inset hover:text-forest"
                  >
                    <Pencil size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => togglePublish(s)}
                    disabled={busyId === s.id}
                    aria-label={published ? "Move to draft" : "Publish"}
                    title={published ? "Move to draft" : "Publish"}
                    className="rounded-lg p-2 text-[color:var(--color-text-muted)] transition-colors hover:bg-inset hover:text-forest disabled:opacity-40"
                  >
                    {published ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    disabled={busyId === s.id}
                    aria-label="Delete note"
                    className="rounded-lg p-2 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-state-error)]/10 hover:text-[color:var(--color-state-error)] disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
