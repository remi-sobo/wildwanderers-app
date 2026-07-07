"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { savePlan, type PlanDraft } from "@/lib/coach/actions";
import { saveAsTemplate } from "@/lib/coach/template-actions";
import { VideoBadge } from "@/components/ui/VideoEmbed";
import type { LibraryItem } from "@/lib/data/exercises";

type ExerciseForm = {
  title: string;
  kind: string;
  sets: string;
  reps: string;
  load: string;
  libraryItemId: string | null;
  mediaUrl: string;
};

type WorkoutForm = {
  weekNumber: number;
  dayNumber: number;
  title: string;
  exercises: ExerciseForm[];
};

// A resting draft loaded for review, mapped to the builder's shape by the
// page that owns the route.
export type BuilderInitial = {
  planId: string;
  title: string;
  goal: string;
  durationWeeks: string;
  aiGenerated: boolean;
  // The client built this one themselves. It can be reviewed and tweaked,
  // never activated as their plan (the database refuses it too).
  clientInitiated: boolean;
  workouts: WorkoutForm[];
};

const KINDS = ["strength", "cardio", "mobility", "warmup", "cooldown", "skill"];

function emptyExercise(): ExerciseForm {
  return { title: "", kind: "strength", sets: "", reps: "", load: "", libraryItemId: null, mediaUrl: "" };
}
function emptyWorkout(day: number): WorkoutForm {
  return { weekNumber: 1, dayNumber: day, title: "", exercises: [emptyExercise()] };
}

const fieldClass =
  "h-11 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";

export function PlanBuilder({
  clientId,
  library,
  initial,
}: {
  clientId: string;
  library: LibraryItem[];
  initial?: BuilderInitial;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [durationWeeks, setDurationWeeks] = useState(initial?.durationWeeks ?? "");
  const [workouts, setWorkouts] = useState<WorkoutForm[]>(
    initial?.workouts.length ? initial.workouts : [emptyWorkout(1)],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"draft" | "activate" | "template" | null>(
    null,
  );
  const [templateNote, setTemplateNote] = useState<string | null>(null);

  // Reviewing a resting draft rather than starting fresh.
  const editingDraft = Boolean(initial?.planId);
  const fromCoach = Boolean(initial?.aiGenerated);
  const fromClient = Boolean(initial?.clientInitiated);

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
  function pickLibrary(wi: number, ei: number, item: LibraryItem) {
    updateExercise(wi, ei, {
      title: item.title,
      kind: item.kind,
      sets: item.default_sets != null ? String(item.default_sets) : "",
      reps: item.default_reps ?? "",
      libraryItemId: item.id,
      mediaUrl: item.media_url ?? "",
    });
    setOpenKey(null);
  }

  function buildDraft(): PlanDraft {
    return {
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
            library_item_id: e.libraryItemId,
            media_url: e.mediaUrl,
          })),
      })),
    };
  }

  function submit(activate: boolean) {
    setError(null);
    setTemplateNote(null);
    setPendingAction(activate ? "activate" : "draft");
    const draft = buildDraft();
    startTransition(async () => {
      const result = await savePlan(clientId, draft, {
        planId: initial?.planId ?? null,
        activate,
      });
      if (result?.error) setError(result.error);
    });
  }

  function saveTemplate() {
    setError(null);
    setTemplateNote(null);
    setPendingAction("template");
    const draft = buildDraft();
    startTransition(async () => {
      const result = await saveAsTemplate(draft);
      if (result.error) setError(result.error);
      else setTemplateNote("Saved to your templates, ready to reuse for any client.");
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {fromClient ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber/40 bg-amber/10 px-5 py-4">
          <Sparkles size={17} className="mt-0.5 shrink-0 text-amber-deep" aria-hidden="true" />
          <p className="text-[13.5px] leading-[1.55] text-forest-deep">
            The client built this workout themselves and sent it for your eyes.
            Tweak it if that helps, save, and mark it reviewed from their Drafts
            list. It stays their own workout, never their plan.
          </p>
        </div>
      ) : fromCoach ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-fern)]/30 bg-[color:var(--color-fern)]/10 px-5 py-4">
          <Sparkles size={17} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
          <p className="text-[13.5px] leading-[1.55] text-forest-deep">
            Scout drafted this plan and it is saved as a draft. Review and edit
            anything, then activate it when it is ready. Nothing goes live until
            you do.
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] text-[color:var(--color-state-error)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Link
          href="/fitness/movements"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:text-fern"
        >
          <Plus size={14} aria-hidden="true" />
          Manage movements
        </Link>
      </div>

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
            {w.exercises.map((ex, ei) => {
              const key = `${wi}-${ei}`;
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
                <div key={ei} className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search
                      size={15}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-faint)]"
                    />
                    <input
                      value={ex.title}
                      onChange={(e) => {
                        updateExercise(wi, ei, { title: e.target.value, libraryItemId: null });
                        setOpenKey(key);
                      }}
                      onFocus={() => setOpenKey(key)}
                      onBlur={() => setTimeout(() => setOpenKey((k) => (k === key ? null : k)), 150)}
                      placeholder="Search the library or type an exercise"
                      className={`${fieldClass} w-full pl-9`}
                    />
                    {matches.length > 0 ? (
                      <ul className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-[320px] max-w-[80vw] overflow-auto rounded-xl border border-[color:var(--border-strong)] bg-card p-1 shadow-[0_12px_30px_rgba(42,33,24,.14)]">
                        {matches.map((it) => (
                          <li key={it.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                pickLibrary(wi, ei, it);
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
                    className={`${fieldClass} w-[96px]`}
                  />
                  <input
                    value={ex.load}
                    onChange={(e) => updateExercise(wi, ei, { load: e.target.value })}
                    placeholder="Load"
                    className={`${fieldClass} w-[96px]`}
                  />
                  {ex.mediaUrl ? <VideoBadge url={ex.mediaUrl} /> : null}
                  {w.exercises.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateWorkout(wi, { exercises: w.exercises.filter((_, j) => j !== ei) })
                      }
                      className="text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
                      aria-label="Remove exercise"
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

      <div className="flex flex-wrap items-center gap-4 border-t border-[color:var(--border-hair)] pt-6">
        {!fromClient ? (
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={pending}
            className="submit !mt-0 max-w-[280px]"
          >
            <span className="submit-label">
              {pending && pendingAction === "activate"
                ? "Saving"
                : editingDraft
                  ? "Approve and activate"
                  : "Create and activate plan"}
            </span>
            <span aria-hidden="true" className="submit-arrow">
              &rarr;
            </span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={pending}
          className="inline-flex items-center rounded-full border border-[color:var(--border-strong)] px-5 py-2.5 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-70"
        >
          {pending && pendingAction === "draft" ? "Saving" : "Save as a draft"}
        </button>
        <button
          type="button"
          onClick={saveTemplate}
          disabled={pending}
          className="inline-flex items-center text-[13px] font-semibold text-forest transition-colors hover:text-fern disabled:opacity-70"
        >
          {pending && pendingAction === "template" ? "Saving" : "Save as a template"}
        </button>
        <Link href={`/program/clients/${clientId}`} className="ww-link text-sm font-semibold text-forest">
          Cancel
        </Link>
      </div>

      {templateNote ? (
        <p className="text-[13px] text-forest" role="status">
          {templateNote}
        </p>
      ) : null}
    </div>
  );
}
