import Link from "next/link";
import { LineChart, ListChecks } from "lucide-react";
import { getMyProgress, getMyLongevity } from "@/lib/data/wellness";
import { WellnessScoreCard } from "@/components/client/WellnessScoreCard";
import { WeightChart } from "@/components/client/WeightChart";
import { LongevityCard } from "@/components/client/LongevityCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ProgressPage() {
  const [{ hasConsent, score, weightSeries, habits, hasAnyData }, longevity] =
    await Promise.all([getMyProgress(), getMyLongevity()]);

  if (!hasConsent) {
    return (
      <EmptyState title="Watch your progress build.">
        Open your tracker and log a few things, and your graphs and wellness
        score show up here.{" "}
        <Link href="/log" className="ww-link font-medium text-forest">
          Start logging
        </Link>
        .
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow text-bark">Your progress</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          A picture of your progress.
        </h1>
      </div>

      <WellnessScoreCard score={score} />

      {longevity.totalCount > 0 ? <LongevityCard longevity={longevity} /> : null}

      {weightSeries.length > 0 ? (
        <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
              <LineChart size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
              Weight over time
            </h2>
          </div>
          <div className="px-4 py-5">
            <WeightChart data={weightSeries} />
          </div>
        </section>
      ) : null}

      {habits.length > 0 ? (
        <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
              <ListChecks size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
              Habits this week
            </h2>
          </div>
          <ul className="flex flex-col gap-4 px-5 py-5">
            {habits.map((h) => {
              const pct = Math.min(
                100,
                Math.round((h.logs_this_week / Math.max(h.target_per_week, 1)) * 100),
              );
              return (
                <li key={h.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14px] text-forest-deep">{h.title}</span>
                    <span className="text-[12.5px] text-[color:var(--color-text-muted)]">
                      {h.logs_this_week}/{h.target_per_week}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-inset">
                    <div className="h-full rounded-full bg-fern" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!hasAnyData ? (
        <EmptyState title="Nothing logged yet.">
          Log a weight, check off a habit, or add some movement, and your graphs
          fill in here.{" "}
          <Link href="/log" className="ww-link font-medium text-forest">
            Open your log
          </Link>
          .
        </EmptyState>
      ) : null}
    </div>
  );
}
