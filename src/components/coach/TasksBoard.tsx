"use client";

// The /tasks surface: program tabs (All, Fitness, Boys Program, General)
// with open counts, and three views. Buckets: bucket cards per program
// with a drill-in, the All tab grouped program then bucket. List: the
// same shelves as headed lists, no cards. Timeline: the six-month phase
// band over This week, Next week, and Later columns (week starts
// Monday), undated tasks collapsed below; a reading view, no dragging.
// Pin-today and due dates keep their behavior everywhere: overdue rises
// first, pinned and due-today next. A row opens the task popout; adding
// a task asks for a program and offers that program's buckets.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pin, ChevronLeft, ChevronRight, CircleCheck, Circle, ListChecks } from "lucide-react";
import { addTask, setTaskDone } from "@/lib/tasks/actions";
import { TaskDrawer } from "@/components/coach/TaskDrawer";
import { PROGRAMS, PROGRAM_LABEL, type TaskProgram } from "@/lib/tasks/programs";
import type { TaskBucket, TaskListItem, TaskComment, StaffOption } from "@/lib/data/tasks";

const PRIORITIES = ["urgent", "high", "medium", "low"];
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

// Tasks that never got a bucket still need a shelf inside their program.
const UNSORTED = "unsorted";

const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayKey(): string {
  return dateKey(new Date());
}
// The org's week starts Monday.
function mondayOfThisWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function plusDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

// The six-month build plan as a fixed reading frame for the Timeline
// view. Hardcoded on purpose: no tables behind it, Gabe reads the season
// he is in. M2 through M5 carry labeled placeholders until the phase
// names are confirmed from the build plan; do not invent them.
const PHASES = [
  { key: "M1", month: "2026-08", label: "August", name: "Foundation + pipeline machine" },
  { key: "M2", month: "2026-09", label: "September", name: "[Phase name to confirm]" },
  { key: "M3", month: "2026-10", label: "October", name: "[Phase name to confirm]" },
  { key: "M4", month: "2026-11", label: "November", name: "[Phase name to confirm]" },
  { key: "M5", month: "2026-12", label: "December", name: "[Phase name to confirm]" },
  { key: "M6", month: "2027-01", label: "January", name: "Spring launch + the checkpoint" },
] as const;

const VIEWS = [
  { key: "buckets", label: "Buckets" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

// Pin-today and due-date behavior, kept as ordering inside every bucket:
// overdue first, then pinned or due today, then upcoming, then undated.
function dueRank(t: TaskListItem, today: string): number {
  if (t.due_date && t.due_date < today) return 0;
  if (t.pin_today || t.due_date === today) return 1;
  if (t.due_date) return 2;
  return 3;
}
function sortOpen(items: SortableTask[], today: string): SortableTask[] {
  return [...items].sort((a, b) => {
    const r = dueRank(a, today) - dueRank(b, today);
    if (r !== 0) return r;
    if (a.due_date && b.due_date && a.due_date !== b.due_date)
      return a.due_date < b.due_date ? -1 : 1;
    return a.sort_orderSafe - b.sort_orderSafe;
  });
}

type SortableTask = TaskListItem & { sort_orderSafe: number };

function TaskRow({
  task,
  today,
  subtitle,
  onOpen,
  onToggle,
  pending,
}: {
  task: TaskListItem;
  today: string;
  subtitle: string | null;
  onOpen: () => void;
  onToggle: () => void;
  pending: boolean;
}) {
  const done = task.status === "done";
  const overdue = !done && task.due_date != null && task.due_date < today;
  const dueToday = !done && task.due_date === today;
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
          {subtitle ? <span>{subtitle}</span> : null}
          {subtitle && task.link ? " · " : ""}
          {task.link ? (
            <span className={`font-semibold ${LINK_CHIP[task.link.kind]}`}>{task.link.name}</span>
          ) : null}
          {task.due_date ? (
            <span className={overdue ? "font-semibold text-[color:var(--color-state-error)]" : dueToday ? "font-semibold text-amber-deep" : ""}>
              {task.link || subtitle ? " · " : ""}
              {overdue ? "overdue, " : ""}due{" "}
              {new Date(task.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          ) : null}
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
  buckets,
  commentsByTask,
  staff,
}: {
  tasks: TaskListItem[];
  buckets: TaskBucket[];
  commentsByTask: Record<string, TaskComment[]>;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [program, setProgram] = useState<"all" | TaskProgram>("all");
  const [view, setView] = useState<ViewKey>("buckets");
  const [bucketKey, setBucketKey] = useState<string | null>(null);
  const [showUndated, setShowUndated] = useState(false);
  const [quick, setQuick] = useState({
    title: "",
    due_date: "",
    priority: "medium",
    assigned_to: "",
    program: "general" as TaskProgram,
    bucket_id: "",
  });

  const today = todayKey();
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;
  const bucketById = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);

  const sortable: SortableTask[] = useMemo(() => {
    // The reader orders by due date then recency; keep that as the tiebreak.
    return tasks.map((t, i) => ({ ...t, sort_orderSafe: i }));
  }, [tasks]);

  const open = useMemo(() => sortable.filter((t) => t.status !== "done"), [sortable]);
  const done = useMemo(() => sortable.filter((t) => t.status === "done"), [sortable]);

  const openByProgram = useMemo(() => {
    const counts: Record<TaskProgram, number> = { fitness: 0, boys: 0, general: 0 };
    for (const t of open) counts[t.program] += 1;
    return counts;
  }, [open]);

  function bucketKeyOf(t: TaskListItem): string {
    return t.bucket_id && bucketById.has(t.bucket_id) ? t.bucket_id : UNSORTED;
  }

  // program -> bucket key -> open tasks, already sorted for display.
  const grouped = useMemo(() => {
    const g = new Map<TaskProgram, Map<string, SortableTask[]>>();
    for (const p of PROGRAMS) g.set(p, new Map());
    for (const t of open) {
      const perBucket = g.get(t.program)!;
      const key = bucketKeyOf(t);
      const list = perBucket.get(key);
      if (list) list.push(t);
      else perBucket.set(key, [t]);
    }
    for (const perBucket of g.values()) {
      for (const [key, list] of perBucket) perBucket.set(key, sortOpen(list, today) as SortableTask[]);
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bucketById, today]);

  // The bucket shelves of one program, in the owner's order, unsorted last.
  function shelvesFor(p: TaskProgram): { key: string; name: string; items: SortableTask[] }[] {
    const perBucket = grouped.get(p) ?? new Map<string, SortableTask[]>();
    const shelves = buckets
      .filter((b) => b.program === p)
      .map((b) => ({ key: b.id, name: b.name, items: perBucket.get(b.id) ?? [] }));
    const unsorted = perBucket.get(UNSORTED);
    if (unsorted && unsorted.length > 0) shelves.push({ key: UNSORTED, name: "Unsorted", items: unsorted });
    return shelves;
  }

  function toggle(task: TaskListItem) {
    setError(null);
    start(async () => {
      const res = await setTaskDone(task.id, task.status !== "done");
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function quickAdd(preset: { program: TaskProgram; bucket_id?: string }) {
    if (!quick.title.trim()) return;
    setError(null);
    start(async () => {
      const res = await addTask({
        title: quick.title,
        due_date: quick.due_date || undefined,
        priority: quick.priority,
        assigned_to: quick.assigned_to || undefined,
        program: preset.program,
        bucket_id: preset.bucket_id || undefined,
      });
      if (res.error) setError(res.error);
      else {
        setQuick({ ...quick, title: "", due_date: "" });
        router.refresh();
      }
    });
  }

  function selectProgram(next: "all" | TaskProgram) {
    setProgram(next);
    setBucketKey(null);
    if (next !== "all") setQuick((q) => ({ ...q, program: next, bucket_id: "" }));
  }

  // The add row, rendered by plain call so the inputs keep focus across
  // re-renders. Context decides how much it asks: the All tab asks for a
  // program and offers its buckets; a program tab presets the program; a
  // bucket drill-in presets both and asks only for the task.
  function addRow(preset: { program?: TaskProgram; bucket_id?: string }) {
    const effectiveProgram = preset.program ?? quick.program;
    const effectiveBucket = preset.bucket_id ?? quick.bucket_id;
    const programBuckets = buckets.filter((b) => b.program === effectiveProgram);
    return (
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            className={field}
            placeholder="Add a task, e.g. text Sara about Thursday"
            value={quick.title}
            onChange={(e) => setQuick({ ...quick, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                quickAdd({ program: effectiveProgram, bucket_id: effectiveBucket || undefined });
            }}
          />
          <input className={field} type="date" aria-label="Due date" value={quick.due_date}
            onChange={(e) => setQuick({ ...quick, due_date: e.target.value })} />
          <select className={`${field} capitalize`} aria-label="Priority" value={quick.priority}
            onChange={(e) => setQuick({ ...quick, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            type="button"
            onClick={() => quickAdd({ program: effectiveProgram, bucket_id: effectiveBucket || undefined })}
            disabled={pending || !quick.title.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
          >
            <Plus size={15} aria-hidden="true" /> Add
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          {preset.program == null ? (
            <select className={field} aria-label="Program" value={quick.program}
              onChange={(e) => setQuick({ ...quick, program: e.target.value as TaskProgram, bucket_id: "" })}>
              {PROGRAMS.map((p) => <option key={p} value={p}>{PROGRAM_LABEL[p]}</option>)}
            </select>
          ) : null}
          {preset.bucket_id == null ? (
            <select className={field} aria-label="Bucket" value={quick.bucket_id}
              onChange={(e) => setQuick({ ...quick, bucket_id: e.target.value })}>
              <option value="">No bucket</option>
              {programBuckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : null}
          {staff.length > 1 ? (
            <select className={field} aria-label="Assign to" value={quick.assigned_to}
              onChange={(e) => setQuick({ ...quick, assigned_to: e.target.value })}>
              <option value="">Assign to me</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : null}
        </div>
        {error ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{error}</p> : null}
      </section>
    );
  }

  function rows(items: SortableTask[], subtitleFor?: (t: SortableTask) => string | null) {
    return (
      <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 shadow-[var(--shadow-card)]">
        {items.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            today={today}
            subtitle={subtitleFor ? subtitleFor(t) : null}
            pending={pending}
            onOpen={() => setOpenTaskId(t.id)}
            onToggle={() => toggle(t)}
          />
        ))}
      </ul>
    );
  }

  // The open shelves of one or more programs as headed lists. The All tab
  // of the Buckets view and the whole List view both read from here.
  function programSections(ps: TaskProgram[]) {
    return ps.map((p) => {
      const shelves = shelvesFor(p).filter((s) => s.items.length > 0);
      if (shelves.length === 0) return null;
      return (
        <section key={p} className="flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
            {PROGRAM_LABEL[p]}
          </h2>
          {shelves.map((s) => (
            <div key={s.key}>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-bark">
                {s.name} <span className="font-normal normal-case tracking-normal text-[color:var(--color-text-faint)]">· {s.items.length}</span>
              </h3>
              {rows(s.items)}
            </div>
          ))}
        </section>
      );
    });
  }

  // Program and bucket on one line, for the views that mix buckets.
  function programBucketSubtitle(t: SortableTask): string {
    const bucket = bucketById.get(t.bucket_id ?? "")?.name;
    return bucket ? `${PROGRAM_LABEL[t.program]} · ${bucket}` : PROGRAM_LABEL[t.program];
  }

  // Timeline: the phase band over three due columns. A reading view; every
  // row keeps the same check, pin display, and popout as everywhere else.
  function timelineView() {
    const monday = mondayOfThisWeek();
    const thisWeekEnd = dateKey(plusDays(monday, 6));
    const nextWeekEnd = dateKey(plusDays(monday, 13));
    const visible = open.filter((t) => program === "all" || t.program === program);
    const dated = visible.filter((t) => t.due_date != null);
    const columns = [
      // Overdue belongs to the week you are standing in, not the past.
      { key: "this", label: "This week", items: dated.filter((t) => t.due_date! <= thisWeekEnd) },
      { key: "next", label: "Next week", items: dated.filter((t) => t.due_date! > thisWeekEnd && t.due_date! <= nextWeekEnd) },
      { key: "later", label: "Later", items: dated.filter((t) => t.due_date! > nextWeekEnd) },
    ].map((c) => ({ ...c, items: sortOpen(c.items, today) }));
    const undated = sortOpen(visible.filter((t) => t.due_date == null), today);
    const monthKey = today.slice(0, 7);

    return (
      <>
        {/* The phase band: where the six-month build stands */}
        <div className="overflow-x-auto">
          <ol className="flex min-w-[680px] gap-1.5">
            {PHASES.map((ph) => {
              const current = ph.month === monthKey;
              return (
                <li
                  key={ph.key}
                  aria-current={current ? "date" : undefined}
                  className={`flex-1 rounded-xl border px-3 py-2.5 ${
                    current
                      ? "border-forest bg-forest"
                      : "border-[color:var(--border-hair)] bg-card"
                  }`}
                >
                  <p className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] ${current ? "text-bone/75" : "text-bark"}`}>
                    {ph.key} · {ph.label}
                    {current ? <span className="ml-1 rounded-full bg-amber px-1.5 py-px normal-case tracking-normal text-[#23170c]">now</span> : null}
                  </p>
                  <p className={`mt-0.5 text-[12px] leading-snug ${current ? "text-bone" : "text-[color:var(--color-text-muted)]"}`}>
                    {ph.name}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Due columns, the org's week starting Monday */}
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {columns.map((c) => (
            <section key={c.key}>
              <h2 className={`mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] ${c.key === "this" ? "text-amber-deep" : "text-bark"}`}>
                {c.label} <span className="font-normal text-[color:var(--color-text-faint)]">· {c.items.length}</span>
              </h2>
              {c.items.length > 0 ? (
                rows(c.items, programBucketSubtitle)
              ) : (
                <p className="text-[13px] text-[color:var(--color-text-muted)]">Nothing due here.</p>
              )}
            </section>
          ))}
        </div>

        {/* Undated, collapsed until asked for */}
        {undated.length > 0 ? (
          <section>
            <button
              type="button"
              aria-expanded={showUndated}
              onClick={() => setShowUndated(!showUndated)}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-bark transition-colors hover:text-forest max-md:min-h-[44px]"
            >
              <ChevronRight
                size={15}
                className={`transition-transform ${showUndated ? "rotate-90" : ""}`}
                aria-hidden="true"
              />
              Undated <span className="font-normal text-[color:var(--color-text-faint)]">· {undated.length}</span>
            </button>
            <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
              These sit off the timeline until they get a date. Open one and give it a week.
            </p>
            {showUndated ? <div className="mt-2">{rows(undated, programBucketSubtitle)}</div> : null}
          </section>
        ) : null}
      </>
    );
  }

  const totalOpen = open.length;
  const currentBucket = bucketKey && bucketKey !== UNSORTED ? bucketById.get(bucketKey) ?? null : null;
  const drillItems =
    program !== "all" && bucketKey
      ? (grouped.get(program)?.get(bucketKey) ?? [])
      : [];
  const drillDone =
    program !== "all" && bucketKey
      ? done.filter((t) => t.program === program && bucketKeyOf(t) === bucketKey).slice(0, 15)
      : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Program tabs */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Program">
        {([["all", "All", totalOpen] as const, ...PROGRAMS.map((p) => [p, PROGRAM_LABEL[p], openByProgram[p]] as const)]).map(
          ([value, tabLabel, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={program === value}
              onClick={() => selectProgram(value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors max-md:min-h-[40px] ${
                program === value
                  ? "bg-forest text-bone"
                  : "border border-[color:var(--border-strong)] bg-card text-[color:var(--color-text)] hover:border-forest"
              }`}
            >
              {tabLabel}
              <span className={program === value ? "text-bone/70" : "text-[color:var(--color-text-faint)]"}>{count}</span>
            </button>
          ),
        )}

        {/* View toggle */}
        <div
          className="ml-auto flex items-center gap-0.5 rounded-full border border-[color:var(--border-strong)] bg-card p-0.5"
          role="tablist"
          aria-label="View"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => {
                setView(v.key);
                setBucketKey(null);
              }}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors max-md:min-h-[36px] ${
                view === v.key
                  ? "bg-forest text-bone"
                  : "text-[color:var(--color-text-muted)] hover:text-forest"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "timeline" ? (
        /* Timeline: the phase band and the due columns */
        timelineView()
      ) : view === "list" ? (
        /* List: the shelves as headed lists, no cards, no drill-in */
        <>
          {addRow(program === "all" ? {} : { program })}
          {programSections(program === "all" ? [...PROGRAMS] : [program])}
          {(() => {
            const doneHere = done.filter((t) => program === "all" || t.program === program).slice(0, 15);
            return doneHere.length > 0 ? (
              <section>
                <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
                  Done <span className="font-normal text-[color:var(--color-text-faint)]">· recent</span>
                </h2>
                {rows(doneHere as SortableTask[], programBucketSubtitle)}
              </section>
            ) : null;
          })()}
        </>
      ) : program === "all" ? (
        /* Buckets, All tab: everything grouped program then bucket */
        <>
          {addRow({})}
          {totalOpen === 0 && done.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 text-[14px] leading-[1.55] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
              <ListChecks size={18} className="mb-2 text-[color:var(--color-text-faint)]" aria-hidden="true" />
              Nothing here yet. Add a task above, or from any lead, client,
              customer, or the boys program, and it lands on this board.
            </div>
          ) : (
            programSections([...PROGRAMS])
          )}
          {done.length > 0 ? (
            <section>
              <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
                Done <span className="font-normal text-[color:var(--color-text-faint)]">· recent</span>
              </h2>
              {rows(done.slice(0, 15) as SortableTask[], (t) => bucketById.get(t.bucket_id ?? "")?.name ?? PROGRAM_LABEL[t.program])}
            </section>
          ) : null}
        </>
      ) : bucketKey == null ? (
        /* One program: its bucket cards */
        <>
          {addRow({ program })}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shelvesFor(program).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setBucketKey(s.key)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
                    {s.name}
                  </span>
                  <span className="block text-[12px] text-[color:var(--color-text-muted)]">
                    {s.items.length === 0 ? "Nothing open" : s.items.length === 1 ? "1 open" : `${s.items.length} open`}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[color:var(--color-text-faint)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            ))}
          </div>
          {shelvesFor(program).every((s) => s.items.length === 0) ? (
            <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
              Everything in {PROGRAM_LABEL[program]} is done. Add the next piece of work above.
            </p>
          ) : null}
        </>
      ) : (
        /* Bucket drill-in */
        <>
          <div>
            <button
              type="button"
              onClick={() => setBucketKey(null)}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest max-md:min-h-[44px]"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {PROGRAM_LABEL[program]}
            </button>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
              {currentBucket?.name ?? "Unsorted"}
            </h2>
          </div>
          {addRow({ program, bucket_id: currentBucket?.id ?? "" })}
          {drillItems.length > 0 ? (
            rows(drillItems)
          ) : (
            <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
              Nothing open in this bucket. Add the next piece of work above.
            </p>
          )}
          {drillDone.length > 0 ? (
            <section>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-bark">Done</h3>
              {rows(drillDone as SortableTask[])}
            </section>
          ) : null}
        </>
      )}

      {openTask ? (
        <TaskDrawer
          key={openTask.id}
          task={openTask}
          buckets={buckets}
          comments={commentsByTask[openTask.id] ?? []}
          staff={staff}
          onClose={() => setOpenTaskId(null)}
        />
      ) : null}
    </div>
  );
}
