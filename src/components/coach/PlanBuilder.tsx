"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { createAndActivatePlan, type PlanDraft } from "@/lib/coach/actions";

type ExerciseForm = {
  title: string;
  kind: string;
  sets: string;
  reps: string;
  load: string;
};

type WorkoutForm = {
  weekNumber: number;
  dayNumber: number;
  title: string;
  exercises: ExerciseForm[];
};

const KINDS = ["strength", "cardio", "mobility", "warmup", "cooldown", "skill"];

function emptyExercise(): ExerciseForm {
  return { title: "", kind: "strength", sets: "", reps: "", load: "" };
}

function emptyWorkout(day: number): WorkoutForm {
  return { weekNumber: 1, dayNumber: day, title: "", exercises: [emptyExercise()] };
}

const fieldClass =
  "h-11 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";

export function PlanBuilder({ clientId }: { clientId: string }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("");
  const [workouts, setWorkouts] = useState<WorkoutForm[]>([emptyWorkout(1)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateWorkout(i: number, patch: Partial<WorkoutForm>) {
    setWorkouts((ws) => ws.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function updateExercise(wi: number, ei: number, patch: Partial<ExerciseForm>) {
    setWorkouts((ws) =>
      ws.map((w, idx) =>
        idx === wi
          ? { ...w, exercises: w.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }
          : w,
      ),
    );
  }

  function submit() {
    setError(null);
    const draft: PlanDraft = {
      title,
      goal,
      durationWeeks,
      workouts: workouts.map((w) => ({
        dayNumber: w.dayNumber,
        weekNumber: w.weekNumber,
        title: w.title,
        exercises: w.exercises
          .filter((e) => e.title.trim())
          .map((e) => ({
            title: e.title,
            kind: e.kind,
            sets: e.sets,
            reps: e.reps,
            rest_seconds: "",
            load: e.load,
            instructions: "",
            is_optional: false,
          })),
      })),
    };
    startTransition(async () => {
      const result = await createAndActivatePlan(clientId, draft);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] text-[color:var(--color-state-error)]"
        >
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="eyebrow text-bark">Plan</p>
        <div className="mt-4 flex flex-col gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Plan title, e.g. Foundations — Weeks 1 to 4"
            className={`${fieldClass} w-full`}
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Goal (optional)"
            className={`${fieldClass} w-full`}
          />
          <input
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Duration in weeks (optional)"
            className={`${fieldClass} w-full max-w-[220px]`}
          />
        </div>
      </div>

      {workouts.map((w, wi) => (
        <div
          key={wi}
          className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow text-bark">Workout {wi + 1}</p>
            {workouts.length > 1 ? (
              <button
                type="button"
                onClick={() => setWorkouts((ws) => ws.filter((_, idx) => idx !== wi))}
                className="text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
                aria-label="Remove workout"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              Week
              <input
                type="number"
                min={1}
                value={w.weekNumber}
                onChange={(e) => updateWorkout(wi, { weekNumber: Number(e.target.value) || 1 })}
                className={`${fieldClass} w-20`}
              />
            </label>
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              Day
              <input
                type="number"
                min={1}
                value={w.dayNumber}
                onChange={(e) => updateWorkout(wi, { dayNumber: Number(e.target.value) || 1 })}
                className={`${fieldClass} w-20`}
              />
            </label>
            <input
              value={w.title}
              onChange={(e) => updateWorkout(wi, { title: e.target.value })}
              placeholder="Workout title, e.g. Lower body"
              className={`${fieldClass} min-w-[200px] flex-1`}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {w.exercises.map((ex, ei) => (
              <div key={ei} className="flex flex-wrap items-center gap-2">
                <input
                  value={ex.title}
                  onChange={(e) => updateExercise(wi, ei, { title: e.target.value })}
                  placeholder="Exercise"
                  className={`${fieldClass} min-w-[180px] flex-1`}
                />
                <select
                  value={ex.kind}
                  onChange={(e) => updateExercise(wi, ei, { kind: e.target.value })}
                  className={`${fieldClass} w-[130px] capitalize`}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  value={ex.sets}
                  onChange={(e) => updateExercise(wi, ei, { sets: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="Sets"
                  className={`${fieldClass} w-[72px]`}
                />
                <input
                  value={ex.reps}
                  onChange={(e) => updateExercise(wi, ei, { reps: e.target.value })}
                  placeholder="Reps"
                  className={`${fieldClass} w-[88px]`}
                />
                <input
                  value={ex.load}
                  onChange={(e) => updateExercise(wi, ei, { load: e.target.value })}
                  placeholder="Load"
                  className={`${fieldClass} w-[96px]`}
                />
                {w.exercises.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateWorkout(wi, {
                        exercises: w.exercises.filter((_, j) => j !== ei),
                      })
                    }
                    className="text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
                    aria-label="Remove exercise"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => updateWorkout(wi, { exercises: [...w.exercises, emptyExercise()] })}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-forest transition-colors hover:text-fern"
          >
            <Plus size={15} /> Add exercise
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setWorkouts((ws) => [...ws, emptyWorkout(ws.length + 1)])}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset"
      >
        <Plus size={16} /> Add workout
      </button>

      <div className="flex items-center gap-4 border-t border-[color:var(--border-hair)] pt-6">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="submit !mt-0 max-w-[260px]"
        >
          <span className="submit-label">
            {pending ? "Saving" : "Create and activate plan"}
          </span>
          <span aria-hidden="true" className="submit-arrow">
            &rarr;
          </span>
        </button>
        <Link
          href={`/program/clients/${clientId}`}
          className="ww-link text-sm font-semibold text-forest"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
