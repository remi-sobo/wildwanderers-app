"use client";

// The /tasks surface: everything the caller can see, grouped by when it
// needs doing (Overdue, Today, This week, Later, recently Done), filtered
// by category or by what the task is linked to. A row opens the task
// popout; the quick add at the top captures a task in one line.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pin, CircleCheck, Circle, ListChecks } from "lucide-react";
import { addTask, setTaskDone } from "@/lib/tasks/actions";
import { TaskDrawer } from "@/components/coach/TaskDrawer";
import type { TaskListItem, TaskComment, StaffOption } from "@/lib/data/tasks";

const CATEGORIES = ["sales", "coaching", "program", "finance", "admin", "other"];
const PRIORITIES = ["urgent", "high", "medium", "low"];
const LINK_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "lead", label: "Leads" },
  { value: "client", label: "Clients" },
  { value: "customer", label: "Customers" },
  { value: "program", label: "Boys program" },
  { value: "none", label: "Unlinked" },
];
const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-[color:var(--color-state-error)]/12 text-[color:var(--color-state-error)]",
  high: "bg-[color:var(--color-state-caution)]/15 text-[color:var(--color-state-caution)]",
  medium: "bg-inset text-[color:var(--color-text-muted)]",
  low: "bg-inset text-[color:var(--color-text-faint)]",
};
const LINK_CHIP: Record<string, string> = {
  lead: "text-amber-deep",
  client: "text-forest",
  customer: "text-bark",
  program: "text-fern",
};

const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function plusDaysKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type GroupKey = "overdue" | "today" | "week" | "later" | "done";
const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "done", label: "Done" },
];

function TaskRow({
  task,
  onOpen,
  onToggle,
  pending,
}: {
  task: TaskListItem;
  onOpen: () => void;
  onToggle: () => void;
  pending: boolean;
}) {
  const done = task.status === "done";
  return (
    <li className="flex items-center gap-2.5 py-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={done ? "Reopen task" : "Mark task done"}
        className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
      >
        {done ? (
          <CircleCheck size={19} className="text-fern" aria-hidden="true" />
        ) : (
          <Circle size={19} className="text-[color:var(--color-text-faint)]" aria-hidden="true" />
        )}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-[14px] ${done ? "text-[color:var(--color-text-faint)] line-through" : "text-forest-deep"}`}>
          {task.pin_today && !done ? <Pin size={11} className="mr-1 inline text-amber-deep" fill="currentColor" aria-hidden="true" /> : null}
          {task.title}
        </p>
        <p className="truncate text-[11.5px] text-[color:var(--color-text-muted)]">
          {task.link ? (
            <span className={`font-semibold ${LINK_CHIP[task.link.kind]}`}>{task.link.name}</span>
          ) : (
            <span className="capitalize">{task.category}</span>
          )}
          {task.due_date
            ? ` · due ${new Date(task.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
            : ""}
          {task.recur !== "none" ? " · repeats" : ""}
          {task.is_next_step ? " · next step" : ""}
        </p>
      </button>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${PRIORITY_STYLE[task.priority]}`}>
        {task.priority}
      </span>
    </li>
  );
}

export function TasksBoard({
  tasks,
  commentsByTask,
  staff,
}: {
  tasks: TaskListItem[];
  commentsByTask: Record<string, TaskComment[]>;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [linkKind, setLinkKind] = useState("all");
  const [quick, setQuick] = useState({ title: "", due_date: "", priority: "medium", category: "other", assigned_to: "" });

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (linkKind === "none" && t.link) return false;
      if (linkKind !== "all" && linkKind !== "none" && t.link?.kind !== linkKind) return false;
      return true;
    });
  }, [tasks, category, linkKind]);

  const grouped = useMemo(() => {
    const today = todayKey();
    const weekEnd = plusDaysKey(7);
    const g: Record<GroupKey, TaskListItem[]> = { overdue: [], today: [], week: [], later: [], done: [] };
    for (const t of filtered) {
      if (t.status === "done") {
        g.done.push(t);
      } else if (t.due_date && t.due_date < today) {
        g.overdue.push(t);
      } else if (t.pin_today || t.due_date === today) {
        g.today.push(t);
      } else if (t.due_date && t.due_date <= weekEnd) {
        g.week.push(t);
      } else {
        g.later.push(t);
      }
    }
    g.done = g.done.slice(0, 15);
    return g;
  }, [filtered]);

  function toggle(task: TaskListItem) {
    setError(null);
    start(async () => {
      const res = await setTaskDone(task.id, task.status !== "done");
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function quickAdd() {
    if (!quick.title.trim()) return;
    setError(null);
    start(async () => {
      const res = await addTask({
        title: quick.title,
        due_date: quick.due_date || undefined,
        priority: quick.priority,
        category: quick.category,
        assigned_to: quick.assigned_to || undefined,
      });
      if (res.error) setError(res.error);
      else {
        setQuick({ ...quick, title: "", due_date: "" });
        router.refresh();
      }
    });
  }

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Quick add */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            className={field}
            placeholder="Add a task, e.g. text Sara about Thursday"
            value={quick.title}
            onChange={(e) => setQuick({ ...quick, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") quickAdd();
            }}
          />
          <input className={field} type="date" aria-label="Due date" value={quick.due_date}
            onChange={(e) => setQuick({ ...quick, due_date: e.target.value })} />
          <select className={`${field} capitalize`} aria-label="Category" value={quick.category}
            onChange={(e) => setQuick({ ...quick, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={`${field} capitalize`} aria-label="Priority" value={quick.priority}
            onChange={(e) => setQuick({ ...quick, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            type="button"
            onClick={quickAdd}
            disabled={pending || !quick.title.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
          >
            <Plus size={15} aria-hidden="true" /> Add
          </button>
        </div>
        {staff.length > 1 ? (
          <div className="mt-2.5">
            <select className={field} aria-label="Assign to" value={quick.assigned_to}
              onChange={(e) => setQuick({ ...quick, assigned_to: e.target.value })}>
              <option value="">Assign to me</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{error}</p> : null}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {LINK_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setLinkKind(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors max-md:min-h-[40px] ${
              linkKind === f.value
                ? "bg-forest text-bone"
                : "border border-[color:var(--border-strong)] bg-card text-[color:var(--color-text)] hover:border-forest"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          className="ml-auto h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[13px] capitalize text-ink max-md:h-11 max-md:text-[16px]"
          aria-label="Category filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Groups */}
      {openCount === 0 && grouped.done.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 text-[14px] leading-[1.55] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
          <ListChecks size={18} className="mb-2 text-[color:var(--color-text-faint)]" aria-hidden="true" />
          Nothing here yet. Add a task above, or from any lead, client,
          customer, or the boys program, and it lands on this board.
        </div>
      ) : (
        GROUPS.map((g) => {
          const items = grouped[g.key];
          if (items.length === 0) return null;
          return (
            <section key={g.key}>
              <h2
                className={`mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] ${
                  g.key === "overdue"
                    ? "text-[color:var(--color-state-error)]"
                    : g.key === "today"
                      ? "text-amber-deep"
                      : "text-bark"
                }`}
              >
                {g.label} <span className="font-normal text-[color:var(--color-text-faint)]">· {items.length}</span>
              </h2>
              <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 shadow-[var(--shadow-card)]">
                {items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    pending={pending}
                    onOpen={() => setOpenTaskId(t.id)}
                    onToggle={() => toggle(t)}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {openTask ? (
        <TaskDrawer
          key={openTask.id}
          task={openTask}
          comments={commentsByTask[openTask.id] ?? []}
          staff={staff}
          onClose={() => setOpenTaskId(null)}
        />
      ) : null}
    </div>
  );
}
