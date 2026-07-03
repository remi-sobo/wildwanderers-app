import { Sparkles } from "lucide-react";
import type { WellnessScore } from "@/lib/data/wellness";

// The wellness score, transparent and motivational. A warm ring in fern to
// amber, the number in Fraunces, then the three components so it is never a
// black box, then the plain note that it is a progress signal, not medical.

function Ring({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;

  return (
    <svg viewBox="0 0 130 130" className="h-32 w-32" aria-hidden="true">
      <defs>
        <linearGradient id="wellness-arc" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-fern)" />
          <stop offset="100%" stopColor="var(--color-amber)" />
        </linearGradient>
      </defs>
      <circle
        cx="65"
        cy="65"
        r={r}
        fill="none"
        stroke="var(--color-inset)"
        strokeWidth="11"
      />
      <circle
        cx="65"
        cy="65"
        r={r}
        fill="none"
        stroke="url(#wellness-arc)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 65 65)"
      />
    </svg>
  );
}

function Component({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-forest-deep">{label}</span>
        <span className="font-[family-name:var(--font-display)] text-[15px] text-bark">
          {value == null ? "—" : value}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full bg-fern"
          style={{ width: `${value == null ? 0 : Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="text-[11.5px] text-[color:var(--color-text-muted)]">{detail}</span>
    </div>
  );
}

export function WellnessScoreCard({ score }: { score: WellnessScore | null }) {
  const value = score?.score ?? null;

  if (value == null) {
    return (
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
            <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
            Your wellness score
          </h2>
        </div>
        <p className="mt-4 text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
          Your score builds as you log. Check off a habit, log a workout, or add
          some movement, and it starts to fill in. It is a picture of your
          progress, moving in your direction.
        </p>
      </section>
    );
  }

  const inputs = score?.inputs;

  return (
    <section className="overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex flex-col items-center gap-4 bg-inset/40 px-6 py-8 sm:flex-row sm:gap-7">
        <div className="relative flex items-center justify-center">
          <Ring score={value} />
          <div className="absolute flex flex-col items-center">
            <span className="font-[family-name:var(--font-display)] text-[40px] leading-none text-forest-deep">
              {value}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-bark">
              of 100
            </span>
          </div>
        </div>
        <div className="text-center sm:text-left">
          <p className="eyebrow text-bark">Your wellness score</p>
          <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-[22px] leading-tight text-forest-deep">
            You are moving in your direction.
          </h2>
          <p className="mt-1.5 max-w-sm text-[13px] leading-[1.5] text-[color:var(--color-text-muted)]">
            A progress number from your training, movement, and habits. It is a
            motivating signal, not a health or medical assessment.
          </p>
        </div>
      </div>

      <div className="grid gap-5 px-6 py-6 sm:grid-cols-3">
        <Component
          label="Consistency"
          value={score?.consistency ?? null}
          detail={
            inputs
              ? `${inputs.required_done} of ${inputs.required_exercises} exercises`
              : "workouts completed"
          }
        />
        <Component
          label="Movement"
          value={score?.movement ?? null}
          detail={
            inputs
              ? `${inputs.movement_minutes_7d} of ${inputs.movement_target} min this week`
              : "minutes this week"
          }
        />
        <Component
          label="Habits"
          value={score?.habits ?? null}
          detail={inputs ? `${inputs.active_habits} active` : "kept this week"}
        />
      </div>
    </section>
  );
}
