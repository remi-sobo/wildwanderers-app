import { LineChart, ListChecks, Activity, Scale } from "lucide-react";
import type { ClientWellness } from "@/lib/data/coach-fitness";
import { WellnessScoreCard } from "@/components/client/WellnessScoreCard";
import { WeightChart } from "@/components/client/WeightChart";
import { cmToIn, kgToLb, round1 } from "@/lib/wellness/units";
import type { Measurement } from "@/lib/data/wellness";

function measurementRows(m: Measurement) {
  const rows: [string, string][] = [];
  if (m.weight_kg != null) rows.push(["Weight", `${round1(kgToLb(m.weight_kg))} lb`]);
  if (m.waist_cm != null) rows.push(["Waist", `${round1(cmToIn(m.waist_cm))} in`]);
  if (m.hip_cm != null) rows.push(["Hip", `${round1(cmToIn(m.hip_cm))} in`]);
  if (m.chest_cm != null) rows.push(["Chest", `${round1(cmToIn(m.chest_cm))} in`]);
  if (m.arm_cm != null) rows.push(["Arm", `${round1(cmToIn(m.arm_cm))} in`]);
  if (m.thigh_cm != null) rows.push(["Thigh", `${round1(cmToIn(m.thigh_cm))} in`]);
  if (m.body_fat_pct != null) rows.push(["Body fat", `${round1(m.body_fat_pct)}%`]);
  return rows;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof LineChart;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
          <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// The coach's read-only view of a client's wellness. Same score, chart, and
// note the client sees, plus the latest measurements and recent movement to
// coach from. Never medical.
export function ClientWellnessDashboard({ data }: { data: ClientWellness }) {
  if (!data.hasConsent) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 text-[14px] leading-[1.55] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
        This client has not opened tracking yet. Once they consent and start
        logging, their measurements, habits, and wellness score show up here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <WellnessScoreCard score={data.score} />

      {data.weightSeries.length > 0 ? (
        <SectionCard icon={LineChart} title="Weight over time">
          <WeightChart data={data.weightSeries} />
        </SectionCard>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {data.latestMeasurement ? (
          <SectionCard icon={Scale} title="Latest measurements">
            <dl className="flex flex-col divide-y divide-[color:var(--border-hair)]">
              {measurementRows(data.latestMeasurement).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2">
                  <dt className="text-[13.5px] text-[color:var(--color-text-muted)]">{k}</dt>
                  <dd className="font-[family-name:var(--font-display)] text-[15px] text-forest-deep">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-[color:var(--color-text-faint)]">
              Taken{" "}
              {new Date(data.latestMeasurement.taken_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </SectionCard>
        ) : null}

        {data.habits.length > 0 ? (
          <SectionCard icon={ListChecks} title="Habits this week">
            <ul className="flex flex-col gap-3.5">
              {data.habits.map((h) => {
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
          </SectionCard>
        ) : null}
      </div>

      {data.recentActivity.length > 0 ? (
        <SectionCard icon={Activity} title="Recent movement">
          <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <span className="text-[14px] text-[color:var(--color-text)]">{a.kind}</span>
                <span className="text-[12.5px] text-[color:var(--color-text-muted)]">
                  {a.duration_minutes ? `${a.duration_minutes} min · ` : ""}
                  {new Date(a.logged_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {!data.hasAnyData ? (
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 text-[14px] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
          Consented, but nothing logged yet. It shows up here as they track.
        </div>
      ) : null}
    </div>
  );
}
