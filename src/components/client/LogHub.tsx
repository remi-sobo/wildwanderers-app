"use client";

import { useState, useTransition } from "react";
import { Check, Scale, Activity, CircleCheck, Circle, UtensilsCrossed } from "lucide-react";
import {
  toggleHabitToday,
  logMeasurement,
  logActivity,
  type MeasurementInput,
  type ActivityInput,
} from "@/lib/wellness/actions";
import { kgToLb, cmToIn, round1 } from "@/lib/wellness/units";
import { FoodCard } from "@/components/client/FoodCard";
import type { HabitToday, Measurement, ActivityLog, FoodLog } from "@/lib/data/wellness";

function Card({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Scale;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
          <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] leading-tight text-forest-deep">
            {title}
          </h2>
          {hint ? (
            <p className="text-[12.5px] text-[color:var(--color-text-muted)]">{hint}</p>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function HabitsCard({ habits }: { habits: HabitToday[] }) {
  const [state, setState] = useState(habits);
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    const habit = state.find((h) => h.id === id);
    if (!habit) return;
    const willCheck = !habit.checked_today;
    setState((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              checked_today: willCheck,
              logs_this_week: h.logs_this_week + (willCheck ? 1 : -1),
            }
          : h,
      ),
    );
    startTransition(async () => {
      const result = await toggleHabitToday(id, willCheck);
      if (result.error) {
        setState((prev) =>
          prev.map((h) =>
            h.id === id
              ? {
                  ...h,
                  checked_today: !willCheck,
                  logs_this_week: h.logs_this_week + (willCheck ? -1 : 1),
                }
              : h,
          ),
        );
      }
    });
  }

  if (state.length === 0) {
    return (
      <p className="text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
        Gabe has not set up habits yet. When he does, they show here to check off
        each day.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {state.map((h) => (
        <li key={h.id}>
          <button
            type="button"
            onClick={() => toggle(h.id)}
            aria-pressed={h.checked_today}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              h.checked_today
                ? "border-[color:var(--color-fern)]/40 bg-[color:var(--color-fern)]/10"
                : "border-[color:var(--border-hair)] bg-canvas hover:border-[color:var(--border-strong)]"
            }`}
          >
            {h.checked_today ? (
              <CircleCheck size={20} className="shrink-0 text-fern" aria-hidden="true" />
            ) : (
              <Circle size={20} className="shrink-0 text-[color:var(--color-text-faint)]" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[14.5px] ${
                  h.checked_today
                    ? "text-forest-deep"
                    : "text-[color:var(--color-text)]"
                }`}
              >
                {h.title}
              </span>
            </span>
            <span className="shrink-0 text-[12px] font-medium text-[color:var(--color-text-muted)]">
              {h.logs_this_week}/{h.target_per_week} this week
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const MEASURE_FIELDS: { key: keyof MeasurementInput; label: string; unit: string }[] = [
  { key: "weight_lb", label: "Weight", unit: "lb" },
  { key: "waist_in", label: "Waist", unit: "in" },
  { key: "hip_in", label: "Hip", unit: "in" },
  { key: "chest_in", label: "Chest", unit: "in" },
  { key: "arm_in", label: "Arm", unit: "in" },
  { key: "thigh_in", label: "Thigh", unit: "in" },
  { key: "body_fat_pct", label: "Body fat", unit: "%" },
];

function lastMeasurementLabel(m: Measurement | null): string | undefined {
  if (!m) return undefined;
  const when = new Date(m.taken_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (m.weight_kg != null) return `Last: ${round1(kgToLb(m.weight_kg))} lb on ${when}`;
  if (m.waist_cm != null) return `Last waist: ${round1(cmToIn(m.waist_cm))} in on ${when}`;
  return `Last logged ${when}`;
}

function MeasurementCard({ latest }: { latest: Measurement | null }) {
  const [values, setValues] = useState<MeasurementInput>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await logMeasurement(values);
      if (result.error) setError(result.error);
      else {
        setValues({});
        setSaved(true);
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MEASURE_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-bark">
              {f.label} <span className="text-[color:var(--color-text-faint)]">({f.unit})</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={values[f.key] ?? ""}
              onChange={(e) => {
                setSaved(false);
                setValues((v) => ({ ...v, [f.key]: e.target.value }));
              }}
              className="h-11 rounded-xl border border-[color:var(--border-strong)] bg-canvas px-3 text-[15px] text-ink"
              placeholder="—"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-amber px-5 py-2.5 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-80"
        >
          {pending ? "Saving" : "Save measurement"}
        </button>
        {saved ? (
          <span className="flex items-center gap-1 text-[13px] text-fern">
            <Check size={15} /> Logged
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}
    </>
  );
}

const ACTIVITY_QUICK = ["Walk", "Run", "Strength", "Cycle", "Mobility", "Hike"];

function ActivityCard({ recent }: { recent: ActivityLog[] }) {
  const [input, setInput] = useState<ActivityInput>({ kind: "", duration_minutes: "" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await logActivity(input);
      if (result.error) setError(result.error);
      else {
        setInput({ kind: "", duration_minutes: "" });
        setSaved(true);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_QUICK.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setSaved(false);
              setInput((v) => ({ ...v, kind: k }));
            }}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
              input.kind === k
                ? "border-forest bg-forest text-bone"
                : "border-[color:var(--border-strong)] bg-canvas text-[color:var(--color-text)] hover:border-forest"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={input.kind}
          onChange={(e) => {
            setSaved(false);
            setInput((v) => ({ ...v, kind: e.target.value }));
          }}
          placeholder="What did you do?"
          className="h-11 flex-1 rounded-xl border border-[color:var(--border-strong)] bg-canvas px-3 text-[15px] text-ink"
        />
        <label className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={input.duration_minutes ?? ""}
            onChange={(e) => {
              setSaved(false);
              setInput((v) => ({ ...v, duration_minutes: e.target.value }));
            }}
            placeholder="min"
            className="h-11 w-24 rounded-xl border border-[color:var(--border-strong)] bg-canvas px-3 text-[15px] text-ink"
          />
          <span className="text-[13px] text-[color:var(--color-text-muted)]">minutes</span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-amber px-5 py-2.5 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-80"
        >
          {pending ? "Saving" : "Log movement"}
        </button>
        {saved ? (
          <span className="flex items-center gap-1 text-[13px] text-fern">
            <Check size={15} /> Logged
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-1.5 border-t border-[color:var(--border-hair)] pt-4">
          {recent.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-[13px]">
              <span className="text-[color:var(--color-text)]">{a.kind}</span>
              <span className="text-[color:var(--color-text-muted)]">
                {a.duration_minutes ? `${a.duration_minutes} min · ` : ""}
                {new Date(a.logged_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function LogHub({
  habits,
  latestMeasurement,
  recentActivity,
  todaysFood,
  todaysCalories,
}: {
  habits: HabitToday[];
  latestMeasurement: Measurement | null;
  recentActivity: ActivityLog[];
  todaysFood: FoodLog[];
  todaysCalories: number;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card icon={Check} title="Today's habits" hint="Tap to check one off.">
        <HabitsCard habits={habits} />
      </Card>
      <Card
        icon={Scale}
        title="Measurements"
        hint={lastMeasurementLabel(latestMeasurement) ?? "Log what you have."}
      >
        <MeasurementCard latest={latestMeasurement} />
      </Card>
      <Card icon={Activity} title="Movement" hint="Log a walk, a run, anything.">
        <ActivityCard recent={recentActivity} />
      </Card>
      <Card icon={UtensilsCrossed} title="Food" hint="Search a food and log it.">
        <FoodCard todaysFood={todaysFood} todaysCalories={todaysCalories} />
      </Card>
    </div>
  );
}
