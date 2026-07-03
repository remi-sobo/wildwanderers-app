import Link from "next/link";
import { Users, TrendingUp, GitBranch, Bell, Target } from "lucide-react";
import { formatMoney, type BusinessDashboard, type GoalProgress } from "@/lib/data/business";

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-bark">
        <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-[30px] leading-none text-forest-deep">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[12.5px] text-[color:var(--color-text-muted)]">{sub}</p> : null}
    </div>
  );
}

function goalLabel(metric: GoalProgress["metric"]): string {
  if (metric === "revenue_mtd") return "Revenue this month";
  if (metric === "active_clients") return "Active clients";
  return "Open pipeline";
}
function goalDisplay(g: GoalProgress): { current: string; target: string; pct: number } {
  const money = g.metric !== "active_clients";
  const fmt = (n: number) => (money ? formatMoney(n * 100) : String(Math.round(n)));
  const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current / g.target_value) * 100)) : 0;
  return { current: fmt(g.current), target: fmt(g.target_value), pct };
}

// The command dashboard's view. Every value comes from real rows; empty states
// are honest, never filled with invented numbers.
export function BusinessDashboardView({ data: d }: { data: BusinessDashboard }) {
  const delta = d.revenueMtdCents - d.revenueLastMonthCents;
  const revSub =
    d.revenueLastMonthCents > 0
      ? `${delta >= 0 ? "+" : ""}${formatMoney(delta)} vs last month`
      : "This month so far";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Active clients" value={String(d.activeClients)} />
        <Stat icon={TrendingUp} label="Revenue, month" value={formatMoney(d.revenueMtdCents)} sub={revSub} />
        <Stat
          icon={GitBranch}
          label="Open pipeline"
          value={formatMoney(d.openPipelineCents)}
          sub={`${d.openLeads} open ${d.openLeads === 1 ? "lead" : "leads"}`}
        />
        <Stat
          icon={Bell}
          label="Needs attention"
          value={String(d.attention.length + d.pinnedTasks)}
          sub={`${d.pinnedTasks} pinned ${d.pinnedTasks === 1 ? "task" : "tasks"}`}
        />
      </div>

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
            <Target size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">Goals</h2>
        </div>
        <div className="p-5">
          {d.goals.length === 0 ? (
            <p className="text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
              No goals set yet. Add one on the{" "}
              <Link href="/business/tasks" className="ww-link font-medium text-forest">
                Tasks
              </Link>{" "}
              page and it shows here with live progress.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {d.goals.map((g) => {
                const { current, target, pct } = goalDisplay(g);
                return (
                  <li key={g.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[14px] text-forest-deep">
                        {g.name}{" "}
                        <span className="text-[12px] text-[color:var(--color-text-faint)]">
                          · {goalLabel(g.metric)} · {g.period}
                        </span>
                      </span>
                      <span className="text-[12.5px] text-[color:var(--color-text-muted)]">
                        {current} / {target}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-inset">
                      <div className="h-full rounded-full bg-fern" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
            <Bell size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
            Follow-ups due
          </h2>
        </div>
        <div className="p-5">
          {d.attention.length === 0 ? (
            <p className="text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
              Nothing due. Leads with a follow-up date show up here when the day
              comes. Work your{" "}
              <Link href="/business/pipeline" className="ww-link font-medium text-forest">
                pipeline
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
              {d.attention.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-forest-deep">{a.name}</p>
                    {a.next_action ? (
                      <p className="truncate text-[12.5px] text-[color:var(--color-text-muted)]">
                        {a.next_action}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[12.5px] text-[color:var(--color-state-caution)]">
                    {a.next_action_date
                      ? new Date(a.next_action_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
