"use client";

// Goals management, the owner's targets the dashboard measures. Extracted
// from the old TasksPanel when tasks grew into the whole-app /tasks surface.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, Trash2 } from "lucide-react";
import { addGoal, deleteGoal, type GoalInput } from "@/lib/business/actions";
import { formatMoney } from "@/lib/business/format";
import type { GoalProgress } from "@/lib/data/business";

const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";
const METRICS = [
  { value: "revenue_mtd", label: "Revenue this month" },
  { value: "active_clients", label: "Active clients" },
  { value: "open_pipeline_value", label: "Open pipeline" },
];

function goalText(g: GoalProgress) {
  const money = g.metric !== "active_clients";
  const fmt = (n: number) => (money ? formatMoney(n * 100) : String(Math.round(n)));
  const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current / g.target_value) * 100)) : 0;
  return { current: fmt(g.current), target: fmt(g.target_value), pct };
}

export function GoalsPanel({ goals }: { goals: GoalProgress[] }) {
  const router = useRouter();
  const [g, setG] = useState<GoalInput>({ name: "", metric: "revenue_mtd", target_value: "", period: "" });
  const [gErr, setGErr] = useState<string | null>(null);
  const [savingG, startG] = useTransition();

  function saveGoal() {
    setGErr(null);
    startG(async () => {
      const res = await addGoal(g);
      if (res.error) setGErr(res.error);
      else { setG({ name: "", metric: g.metric, target_value: "", period: "" }); router.refresh(); }
    });
  }
  function removeGoal(id: string) {
    startG(async () => { await deleteGoal(id); router.refresh(); });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
          <Target size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">Goals</h2>
      </div>
      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={field} placeholder="Name, e.g. August revenue" value={g.name}
            onChange={(e) => setG({ ...g, name: e.target.value })} />
          <select className={field} value={g.metric} onChange={(e) => setG({ ...g, metric: e.target.value })}>
            {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input className={field} inputMode="decimal" placeholder="Target" value={g.target_value}
            onChange={(e) => setG({ ...g, target_value: e.target.value })} />
          <input className={field} placeholder="Period 2026-08" value={g.period}
            onChange={(e) => setG({ ...g, period: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={saveGoal} disabled={savingG || !g.name.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[13.5px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-70 max-md:min-h-[44px]">
            <Plus size={15} /> Set goal
          </button>
          {gErr ? <span className="text-[13px] text-[color:var(--color-state-error)]">{gErr}</span> : null}
        </div>

        {goals.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-4">
            {goals.map((goal) => {
              const { current, target, pct } = goalText(goal);
              return (
                <li key={goal.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] text-forest-deep">
                      {goal.name} <span className="text-[12px] text-[color:var(--color-text-faint)]">· {goal.period}</span>
                    </span>
                    <span className="flex items-center gap-2 text-[12.5px] text-[color:var(--color-text-muted)]">
                      {current} / {target}
                      <button type="button" onClick={() => removeGoal(goal.id)} aria-label="Delete goal"
                        className="-m-4 flex h-11 w-11 items-center justify-center text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]">
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-inset">
                    <div className="h-full rounded-full bg-fern" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-[13.5px] text-[color:var(--color-text-muted)]">
            No goals set. Pick a metric and a period, and the dashboard measures it.
          </p>
        )}
      </div>
    </section>
  );
}
