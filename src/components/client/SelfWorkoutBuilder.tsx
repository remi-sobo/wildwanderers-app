"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import { createSelfWorkout, type SelfExerciseInput } from "@/lib/training/self-actions";
import type { LibraryItem } from "@/lib/data/exercises";

// The client's own workout builder: pick movements from the library, set your
// numbers, save. Yours to do any time; your coach's plan stays your plan.
// There is no AI in this path, on purpose.

const KINDS = ["strength", "cardio", "mobility", "warmup", "cooldown", "skill"];

function emptyExercise(): SelfExerciseInput {
  return { title: "", kind: "strength", sets: "", reps: "", load: "", libraryItemId: null, mediaUrl: "" };
}

const fieldClass =
  "h-11 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

export function SelfWorkoutBuilder({ library }: { library: LibraryItem[] }) {
  const [title, setTitle] = useState("");
  const [exercises, setExercises] = useState<SelfExerciseInput[]>([emptyExercise()]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateExercise(i: number, patch: Partial<SelfExerciseInput>) {
    setExercises((es) => es.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function pickLibrary(i: number, item: LibraryItem) {
    updateExercise(i, {
      title: item.title,
      kind: item.kind,
      sets: item.default_sets != null ? String(item.default_sets) : "",
      reps: item.default_reps ?? "",
      libraryItemId: item.id,
      mediaUrl: item.media_url ?? "",
    });
    setOpenIndex(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createSelfWorkout(title, exercises);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] text-[color:var(--color-state-error)]"
        >
          {error}
        </p>
      ) : null}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name it, e.g. Saturday strength"
        className={`${fieldClass} w-full`}
      />

      <div className="flex flex-col gap-2.5">
        {exercises.map((ex, i) => {
          const q = ex.title.trim().toLowerCase();
          const matches =
            openIndex === i
              ? library
                  .filter(
                    (it) =>
                      !q ||
                      it.title.toLowerCase().includes(q) ||
                      (it.muscle_group ?? "").toLowerCase().includes(q),
                  )
                  .slice(0, 8)
              : [];
          return (
            <div key={i} className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
              <div className="relative col-span-2 sm:min-w-[180px] sm:flex-1">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-faint)]"
                />
                <input
                  value={ex.title}
                  onChange={(e) => {
                    updateExercise(i, { title: e.target.value, libraryItemId: null });
                    setOpenIndex(i);
                  }}
                  onFocus={() => setOpenIndex(i)}
                  onBlur={() => setTimeout(() => setOpenIndex((k) => (k === i ? null : k)), 150)}
                  placeholder="Search the movement library"
                  className={`${fieldClass} w-full pl-9`}
                />
                {matches.length > 0 ? (
                  <ul className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-full min-w-[260px] max-w-[calc(100vw-2.5rem)] overflow-auto rounded-xl border border-[color:var(--border-strong)] bg-card p-1 shadow-[0_12px_30px_rgba(42,33,24,.14)]">
                    {matches.map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickLibrary(i, it);
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-inset"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-medium text-ink">
                              {it.title}
                            </span>
                            {it.muscle_group ? (
                              <span className="block truncate text-[11.5px] text-[color:var(--color-text-muted)]">
                                {it.muscle_group}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 rounded-full bg-inset px-2 py-0.5 text-[10.5px] font-semibold capitalize text-bark">
                            {it.kind}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <select
                value={ex.kind}
                onChange={(e) => updateExercise(i, { kind: e.target.value })}
                className={`${fieldClass} col-span-2 w-full capitalize sm:w-[120px]`}
                aria-label="Kind"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                value={ex.sets}
                onChange={(e) => updateExercise(i, { sets: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="Sets"
                inputMode="numeric"
                className={`${fieldClass} w-full sm:w-[68px]`}
              />
              <input
                value={ex.reps}
                onChange={(e) => updateExercise(i, { reps: e.target.value })}
                placeholder="Reps"
                className={`${fieldClass} w-full sm:w-[88px]`}
              />
              {exercises.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setExercises((es) => es.filter((_, j) => j !== i))}
                  className="col-span-2 flex h-11 w-11 items-center justify-center justify-self-end text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)] sm:col-span-1"
                  aria-label="Remove movement"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setExercises((es) => [...es, emptyExercise()])}
        className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-forest transition-colors hover:text-fern max-md:min-h-[44px]"
      >
        <Plus size={15} /> Add a movement
      </button>

      <div className="flex items-center gap-4 border-t border-[color:var(--border-hair)] pt-5">
        <button type="button" onClick={submit} disabled={pending} className="submit !mt-0 max-w-[220px]">
          <span className="submit-label">{pending ? "Saving" : "Save my workout"}</span>
          <span aria-hidden="true" className="submit-arrow">
            &rarr;
          </span>
        </button>
        <Link
          href="/training"
          className="ww-link inline-flex items-center text-sm font-semibold text-forest max-md:min-h-[44px]"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
