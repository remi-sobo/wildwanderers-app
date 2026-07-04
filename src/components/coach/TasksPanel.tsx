"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pin, CircleCheck, Circle, Target, Trash2 } from "lucide-react";
import {
  addTask,
  setTaskDone,
  toggleTaskPin,
  addGoal,
  deleteGoal,
  type TaskInput,
  type GoalInput,
} from "@/lib/business/actions";
import { formatMoney } from "@/lib/business/format";
import type { BusinessTask, GoalProgress } from "@/lib/data/business";

const field =
  "h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";
const TASK_CATS = ["sales", "coaching", "program", "finance", "admin", "other"];
const PRIORITIES = ["urgent", "high", "medium", "low"];
const METRICS = [
  { value: "revenue_mtd", label: "Revenue this month" },
  { value: "active_clients", label: "Active clients" },
  { value: "open_pipeline_value", label: "Open pipeline" },
];
const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-[color:var(--color-state-error)]/12 text-[color:var(--color-state-error)]",
  high: "bg-[color:var(--color-state-caution)]/15 text-[color:var(--color-state-caution)]",
  medium: "bg-inset text-[color:var(--color-text-muted)]",
  low: "bg-inset text-[color:var(--color-text-faint)]",
};

function TaskRow({ task }: { task: BusinessTask }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = task.status === "done";

  function complete() {
    start(async () => { await setTaskDone(task.id, !done); router.refresh(); });
  }
  function pin() {
    start(async () => { await toggleTaskPin(task.id, !task.pin_today); router.refresh(); });
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={complete} disabled={pending} aria-label="Toggle done" className="shrink-0">
        {done ? (
          <CircleCheck size={20} className="text-fern" aria-hidden="true" />
        ) : (
          <Circle size={20} className="text-[color:var(--color-text-faint)]" aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] ${done ? "text-[color:var(--color-text-faint)] line-through" : "text-forest-deep"}`}>
          {task.title}
        </p>
        <p className="text-[11.5px] capitalize text-[color:var(--color-text-muted)]">
          {task.category}
          {task.due_date ? ` · due ${new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${PRIORITY_STYLE[task.priority]}`}>
        {task.priority}
      </span>
      <button type="button" onClick={pin} disabled={pending} aria-label="Pin for today"
        className={`shrink-0 transition-colors ${task.pin_today ? "text-amber-deep" : "text-[color:var(--color-text-faint)] hover:text-bark"}`}>
        <Pin size={16} fill={task.pin_today ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </li>
  );
}

function goalText(g: GoalProgress) {
  const money = g.metric !== "active_clients";
  const fmt = (n: number) => (money ? formatMoney(n * 100) : String(Math.round(n)));
  const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current / g.target_value) * 100)) : 0;
  return { current: fmt(g.current), target: fmt(g.target_value), pct };
}

export function TasksPanel({ tasks, goals }: { tasks: BusinessTask[]; goals: GoalProgress[] }) {
  const router = useRouter();
  const [t, setT] = useState<TaskInput>({ title: "", category: "sales", priority: "medium" });
  const [g, setG] = useState<GoalInput>({ name: "", metric: "revenue_mtd", target_value: "", period: "" });
  const [tErr, setTErr] = useState<string | null>(null);
  const [gErr, setGErr] = useState<string | null>(null);
  const [savingT, startT] = useTransition();
  const [savingG, startG] = useTransition();

  function saveTask() {
    setTErr(null);
    startT(async () => {
      const res = await addTask(t);
      if (res.error) setTErr(res.error);
      else { setT({ title: "", category: t.category, priority: t.priority }); router.refresh(); }
    });
  }
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

  const pinned = tasks.filter((x) => x.pin_today && x.status !== "done");
  const rest = tasks.filter((x) => !(x.pin_today && x.status !== "done"));

  return (
    <div className="flex flex-col gap-5">
      {/* Tasks */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-[color:var(--border-hair)] px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">Tasks</h2>
        </div>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <input className={`${field} sm:col-span-2`} placeholder="What needs doing?" value={t.title}
              onChange={(e) => setT({ ...t, title: e.target.value })} />
            <select className={`${field} capitalize`} value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}>
              {TASK_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={`${field} capitalize`} value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <button type="button" onClick={saveTask} disabled={savingT || !t.title.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70">
              <Plus size={15} /> Add task
            </button>
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
              <input type="checkbox" checked={Boolean(t.pin_today)} onChange={(e) => setT({ ...t, pin_today: e.target.checked })} />
              Pin for today
            </label>
            {tErr ? <span className="text-[13px] text-[color:var(--color-state-error)]">{tErr}</span> : null}
          </div>

          {tasks.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-[color:var(--color-text-muted)]">
              Nothing on the list. Add a task and pin the ones for today.
            </p>
          ) : (
            <>
              {pinned.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-deep">Today</p>
                  <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
                    {pinned.map((x) => <TaskRow key={x.id} task={x} />)}
                  </ul>
                </div>
              ) : null}
              <ul className="mt-2 flex flex-col divide-y divide-[color:var(--border-hair)]">
                {rest.map((x) => <TaskRow key={x.id} task={x} />)}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Goals */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
            <Target size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">Goals</h2>
        </div>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <input className={field} placeholder="Name, e.g. July revenue" value={g.name}
              onChange={(e) => setG({ ...g, name: e.target.value })} />
            <select className={field} value={g.metric} onChange={(e) => setG({ ...g, metric: e.target.value })}>
              {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input className={field} inputMode="decimal" placeholder="Target" value={g.target_value}
              onChange={(e) => setG({ ...g, target_value: e.target.value })} />
            <input className={field} placeholder="Period 2026-07" value={g.period}
              onChange={(e) => setG({ ...g, period: e.target.value })} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={saveGoal} disabled={savingG || !g.name.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[13.5px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-70">
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
                          className="text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]">
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
          ) : null}
        </div>
      </section>
    </div>
  );
}
