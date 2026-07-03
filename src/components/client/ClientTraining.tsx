"use client";

import { useState } from "react";
import { Check, PlayCircle } from "lucide-react";
import { setExerciseComplete } from "@/lib/training/actions";
import type { PlanWithWorkouts, Exercise } from "@/lib/data/plans";

function detail(ex: Exercise): string {
  const parts: string[] = [];
  if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.reps) parts.push(ex.reps);
  if (ex.load) parts.push(ex.load);
  return parts.join(" · ");
}

export function ClientTraining({
  plan,
  completedIds,
}: {
  plan: PlanWithWorkouts;
  completedIds: string[];
}) {
  const [done, setDone] = useState<Set<string>>(new Set(completedIds));

  async function toggle(id: string) {
    const next = new Set(done);
    const willComplete = !next.has(id);
    if (willComplete) next.add(id);
    else next.delete(id);
    setDone(next);

    const result = await setExerciseComplete(id, willComplete);
    if (result.error) {
      // revert
      setDone((prev) => {
        const rb = new Set(prev);
        if (willComplete) rb.delete(id);
        else rb.add(id);
        return rb;
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {plan.workouts.map((w) => {
        const required = w.exercises.filter((e) => !e.is_optional);
        const doneCount = required.filter((e) => done.has(e.id)).length;
        const complete = required.length > 0 && doneCount === required.length;
        return (
          <section
            key={w.id}
            className="overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border-hair)] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                  Week {w.week_number} · Day {w.day_number}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
                  {w.title || `Workout ${w.day_number}`}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                  complete
                    ? "bg-[color:var(--color-state-good)]/12 text-[color:var(--color-state-good)]"
                    : "bg-inset text-[color:var(--color-text-muted)]"
                }`}
              >
                {complete ? "Done" : `${doneCount}/${required.length}`}
              </span>
            </div>

            <ul className="flex flex-col">
              {w.exercises.map((ex) => {
                const isDone = done.has(ex.id);
                return (
                  <li
                    key={ex.id}
                    className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-3 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(ex.id)}
                      aria-pressed={isDone}
                      aria-label={isDone ? `Mark ${ex.title} not done` : `Mark ${ex.title} done`}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isDone
                          ? "border-fern bg-fern text-bone"
                          : "border-[color:var(--border-strong)] text-transparent hover:border-fern"
                      }`}
                    >
                      <Check size={15} strokeWidth={2.5} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[14.5px] ${
                          isDone
                            ? "text-[color:var(--color-text-faint)] line-through"
                            : "text-[color:var(--color-text)]"
                        }`}
                      >
                        {ex.title}
                        {ex.is_optional ? (
                          <span className="ml-2 text-[11px] text-[color:var(--color-text-faint)]">
                            optional
                          </span>
                        ) : null}
                      </p>
                      {detail(ex) ? (
                        <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                          {detail(ex)}
                        </p>
                      ) : null}
                    </div>
                    {ex.media_url ? (
                      <a
                        href={ex.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-forest transition-colors hover:text-fern"
                        aria-label="Watch demo"
                      >
                        <PlayCircle size={18} />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
