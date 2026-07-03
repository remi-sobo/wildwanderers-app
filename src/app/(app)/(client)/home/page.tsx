import Link from "next/link";
import { CalendarDays, CalendarClock, ChevronRight } from "lucide-react";
import { getMyTraining, currentWorkoutIndex } from "@/lib/data/training";
import { getMyNextSession } from "@/lib/data/sessions";
import { Ridgeline } from "@/components/brand/Ridgeline";
import { EmptyState } from "@/components/ui/EmptyState";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ClientHomePage() {
  const [{ client, plan, completedIds }, nextSession] = await Promise.all([
    getMyTraining(),
    getMyNextSession(),
  ]);

  const firstName = client?.first_name?.trim();
  const completed = new Set(completedIds);
  const todaysWorkout =
    plan && plan.workouts.length > 0
      ? plan.workouts[currentWorkoutIndex(plan, completed)]
      : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl bg-chrome shadow-[var(--shadow-card)]">
        <Ridgeline className="absolute inset-x-0 bottom-0 h-20 w-full" />
        <div className="relative z-10 px-6 pb-10 pt-7">
          <p className="eyebrow text-[10px] text-bone/60">Wild Wanderers</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-tight text-bone">
            {firstName ? `Good to see you, ${firstName}.` : "Good to see you."}
          </h1>
        </div>
      </section>

      {nextSession ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)]">
          <CalendarClock size={18} className="shrink-0 text-forest" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
              Next session
            </p>
            <p className="text-[15px] text-forest-deep">{nextSession.title}</p>
          </div>
          <span className="shrink-0 text-[13px] text-[color:var(--color-text-muted)]">
            {formatWhen(nextSession.start_at)}
          </span>
        </div>
      ) : null}

      {todaysWorkout ? (
        <Link
          href="/training"
          className="group flex items-center gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
              Today&apos;s workout
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
              {todaysWorkout.title || `Workout ${todaysWorkout.day_number}`}
            </p>
            <p className="text-[13px] text-[color:var(--color-text-muted)]">
              {todaysWorkout.exercises.length}{" "}
              {todaysWorkout.exercises.length === 1 ? "exercise" : "exercises"}
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors group-hover:bg-amber-deep">
            Start
            <ChevronRight size={16} />
          </span>
        </Link>
      ) : (
        <EmptyState icon={CalendarDays} title="Your day starts here.">
          Once Gabe sets up your plan, today&apos;s workout and your next session
          show up on this screen. Nothing to do yet, and that is fine.
        </EmptyState>
      )}
    </div>
  );
}
