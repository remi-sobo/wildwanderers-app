"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  createSelfPlan,
  type SelfDayInput,
  type SelfExerciseInput,
} from "@/lib/training/self-actions";
import type { LibraryItem } from "@/lib/data/exercises";

// The client's own builder: pick movements from the library, set your
// numbers, add up to seven days, save. Yours to do any time; your coach's
// plan stays your plan. There is no AI in this path, on purpose.

const KINDS = ["strength", "cardio", "mobility", "warmup", "cooldown", "skill"];
const MAX_DAYS = 7;

function emptyExercise(): SelfExerciseInput {
  return { title: "", kind: "strength", sets: "", reps: "", load: "", libraryItemId: null, mediaUrl: "" };
}
function emptyDay(): SelfDayInput {
  return { title: "", exercises: [emptyExercise()] };
}

const fieldClass =
  "h-11 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";

export type BuilderStart = { title: string; days: SelfDayInput[] };

export function SelfWorkoutBuilder({
  library,
  initial,
}: {
  library: LibraryItem[];
  initial?: BuilderStart;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [days, setDays] = useState<SelfDayInput[]>(
    initial?.days.length ? initial.days.slice(0, MAX_DAYS) : [emptyDay()],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateDay(di: number, patch: Partial<SelfDayInput>) {
    setDays((ds) => ds.map((d, idx) => (idx === di ? { ...d, ...patch } : d)));
  }
  function updateExercise(di: number, i: number, patch: Partial<SelfExerciseInput>) {
    setDays((ds) =>
      ds.map((d, idx) =>
        idx === di
          ? { ...d, exercises: d.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }
          : d,
      ),
    );
  }
  function pickLibrary(di: number, i: number, item: LibraryItem) {
    updateExercise(di, i, {
      title: item.title,
      kind: item.kind,
      sets: item.default_sets != null ? String(item.default_sets) : "",
      reps: item.default_reps ?? "",
      libraryItemId: item.id,
      mediaUrl: item.media_url ?? "",
    });
    setOpenKey(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createSelfPlan(title, days);
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

      {days.map((day, di) => (
        <div
          key={di}
          className="flex flex-col gap-2.5 rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]"
        >
          {days.length > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                Day {di + 1}
              </span>
              <input
                value={day.title}
                onChange={(e) => updateDay(di, { title: e.target.value })}
                placeholder="Name this day (optional)"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[color:var(--border-strong)] bg-card px-2.5 text-[13px] text-ink"
              />
              <button
                type="button"
                onClick={() => setDays((ds) => ds.filter((_, j) => j !== di))}
                aria-label={`Remove day ${di + 1}`}
                className="text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : null}

          {day.exercises.map((ex, i) => {
            const key = `${di}-${i}`;
            const q = ex.title.trim().toLowerCase();
            const matches =
              openKey === key
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
              <div key={i} className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-faint)]"
                  />
                  <input
                    value={ex.title}
                    onChange={(e) => {
                      updateExercise(di, i, { title: e.target.value, libraryItemId: null });
                      setOpenKey(key);
                    }}
                    onFocus={() => setOpenKey(key)}
                    onBlur={() => setTimeout(() => setOpenKey((k) => (k === key ? null : k)), 150)}
                    placeholder="Search the movement library"
                    className={`${fieldClass} w-full pl-9`}
                  />
                  {matches.length > 0 ? (
                    <ul className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-[300px] max-w-[80vw] overflow-auto rounded-xl border border-[color:var(--border-strong)] bg-card p-1 shadow-[0_12px_30px_rgba(42,33,24,.14)]">
                      {matches.map((it) => (
                        <li key={it.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickLibrary(di, i, it);
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
                  onChange={(e) => updateExercise(di, i, { kind: e.target.value })}
                  className={`${fieldClass} w-[120px] capitalize`}
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
                  onChange={(e) => updateExercise(di, i, { sets: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="Sets"
                  inputMode="numeric"
                  className={`${fieldClass} w-[68px]`}
                />
                <input
                  value={ex.reps}
                  onChange={(e) => updateExercise(di, i, { reps: e.target.value })}
                  placeholder="Reps"
                  className={`${fieldClass} w-[88px]`}
                />
                {day.exercises.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateDay(di, { exercises: day.exercises.filter((_, j) => j !== i) })
                    }
                    className="text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
                    aria-label="Remove movement"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => updateDay(di, { exercises: [...day.exercises, emptyExercise()] })}
            className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-forest transition-colors hover:text-fern"
          >
            <Plus size={15} /> Add a movement
          </button>
        </div>
      ))}

      {days.length < MAX_DAYS ? (
        <button
          type="button"
          onClick={() => setDays((ds) => [...ds, emptyDay()])}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-semibold text-forest transition-colors hover:bg-inset"
        >
          <Plus size={15} /> Add a day
        </button>
      ) : (
        <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
          Seven days is the most that fits here. For a longer stretch, talk with
          your coach.
        </p>
      )}

      <div className="flex items-center gap-4 border-t border-[color:var(--border-hair)] pt-5">
        <button type="button" onClick={submit} disabled={pending} className="submit !mt-0 max-w-[220px]">
          <span className="submit-label">
            {pending ? "Saving" : days.length > 1 ? "Save my plan" : "Save my workout"}
          </span>
          <span aria-hidden="true" className="submit-arrow">
            &rarr;
          </span>
        </button>
        <Link href="/training" className="ww-link text-sm font-semibold text-forest">
          Cancel
        </Link>
      </div>
    </div>
  );
}
