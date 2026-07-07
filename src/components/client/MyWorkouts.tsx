"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eye, Plus, Send, Trash2 } from "lucide-react";
import { setExerciseComplete } from "@/lib/training/actions";
import { sendSelfWorkoutToCoach, deleteSelfWorkout } from "@/lib/training/self-actions";
import { logActivity } from "@/lib/wellness/actions";
import type { MyWorkout } from "@/lib/data/training";

function detail(ex: MyWorkout["exercises"][number]): string {
  const parts: string[] = [];
  if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.reps) parts.push(ex.reps);
  if (ex.load) parts.push(ex.load);
  return parts.join(" · ");
}

// The client's own workouts, beside the coach's plan. Check movements off the
// same way, send one to your coach for a look, and when it is done, log it as
// movement with your own minutes. Nothing here is estimated for you.
export function MyWorkouts({
  workouts,
  completedIds,
}: {
  workouts: MyWorkout[];
  completedIds: string[];
}) {
  const [done, setDone] = useState<Set<string>>(new Set(completedIds));
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  async function toggle(id: string) {
    const next = new Set(done);
    const willComplete = !next.has(id);
    if (willComplete) next.add(id);
    else next.delete(id);
    setDone(next);
    const result = await setExerciseComplete(id, willComplete);
    if (result.error) {
      setDone((prev) => {
        const rb = new Set(prev);
        if (willComplete) rb.delete(id);
        else rb.add(id);
        return rb;
      });
    }
  }

  function logMovement(w: MyWorkout) {
    const mins = minutes[w.planId]?.trim();
    if (!mins) return;
    startTransition(async () => {
      const result = await logActivity({ kind: w.title, duration_minutes: mins });
      if (!result.error) setLogged((prev) => new Set(prev).add(w.planId));
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
          My workouts
        </h2>
        <Link
          href="/training/build"
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset"
        >
          <Plus size={14} aria-hidden="true" />
          Build a workout
        </Link>
      </div>

      {workouts.length === 0 ? (
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
          Build your own workout from the movement library and it lives here,
          beside your plan.
        </p>
      ) : (
        workouts.map((w) => {
          const doneCount = w.exercises.filter((e) => done.has(e.id)).length;
          const complete = w.exercises.length > 0 && doneCount === w.exercises.length;
          const send = sendSelfWorkoutToCoach.bind(null, w.planId);
          const remove = deleteSelfWorkout.bind(null, w.planId);
          return (
            <div
              key={w.planId}
              className="overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-hair)] px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
                    {w.title}
                  </p>
                  {w.reviewedAt ? (
                    <p className="flex items-center gap-1 text-[12px] text-forest">
                      <Eye size={12} aria-hidden="true" /> Your coach took a look
                    </p>
                  ) : w.status === "pending_review" ? (
                    <p className="text-[12px] text-[color:var(--color-text-muted)]">
                      Sent to your coach
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                    complete
                      ? "bg-[color:var(--color-state-good)]/12 text-[color:var(--color-state-good)]"
                      : "bg-inset text-[color:var(--color-text-muted)]"
                  }`}
                >
                  {complete ? "Done" : `${doneCount}/${w.exercises.length}`}
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
                        </p>
                        {detail(ex) ? (
                          <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                            {detail(ex)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--border-hair)] px-5 py-3">
                {complete && !logged.has(w.planId) ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={minutes[w.planId] ?? ""}
                      onChange={(e) =>
                        setMinutes((m) => ({
                          ...m,
                          [w.planId]: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      inputMode="numeric"
                      placeholder="Minutes"
                      aria-label="How many minutes did it take"
                      className="h-9 w-[92px] rounded-lg border border-[color:var(--border-strong)] bg-card px-2.5 text-[13px] text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => logMovement(w)}
                      disabled={pending || !minutes[w.planId]?.trim()}
                      className="rounded-full bg-forest px-3.5 py-1.5 text-[12.5px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-60"
                    >
                      Log it as movement
                    </button>
                  </div>
                ) : null}
                {logged.has(w.planId) ? (
                  <p className="text-[12.5px] font-semibold text-forest" role="status">
                    Logged. It counts toward your movement.
                  </p>
                ) : null}
                <div className="ml-auto flex items-center gap-3">
                  {w.status === "draft" && !w.reviewedAt ? (
                    <form action={send}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:text-fern"
                      >
                        <Send size={13} aria-hidden="true" />
                        Send to my coach
                      </button>
                    </form>
                  ) : null}
                  <form action={remove}>
                    <button
                      type="submit"
                      aria-label={`Delete ${w.title}`}
                      className="text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
