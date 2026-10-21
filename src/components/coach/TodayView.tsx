"use client";

// Today (owner HQ layout): pinned tasks, what is due or overdue, and the
// day's schedule, all real rows. Checking off and unpinning go through
// the same task actions as /tasks, so recurrence and every other view
// stay in step. A row changes only after the save succeeds; a failed
// save leaves it as it was and says so. "Today" is the viewer's own
// local day, read after mount, the same way the Schedule grid works.

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pin } from "lucide-react";
import { setTaskDone, toggleTaskPin } from "@/lib/tasks/actions";
import type { TaskListItem } from "@/lib/data/tasks";
import type { ScheduleBlock, BlockTaskLink } from "@/lib/data/schedule";
import type { SessionRow } from "@/lib/data/sessions";
import { RECURS, formatRange, formatMinutes, weekStartKey } from "@/lib/schedule/blocks";
import { localDayKey } from "@/lib/hq/business-home";
import { buildAgenda, dueLabel, nextUp, selectTodayTasks, type AgendaItem } from "@/lib/hq/today";

function TaskRow({
  task,
  todayKey,
  busy,
  error,
  onDone,
  onUnpin,
}: {
  task: TaskListItem;
  todayKey: string;
  busy: boolean;
  error: string | null;
  onDone: () => void;
  onUnpin?: () => void;
}) {
  const due = task.due_date ? dueLabel(task.due_date, todayKey) : null;
  return (
    <li className="border-t border-[color:var(--border-hair)] first:border-t-0">
      <div className="flex items-start gap-3 py-3">
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          aria-label={`Mark "${task.title}" done`}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-[color:var(--border-strong)] bg-card text-transparent transition-colors hover:border-fern hover:text-fern disabled:opacity-50"
        >
          <Check size={17} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <Link
            href={task.link?.href ?? "/tasks"}
            className="block text-[15.5px] font-semibold leading-snug text-forest-deep hover:underline"
          >
            {task.title}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
            {due ? (
              <span className={due.overdue ? "font-semibold text-[#8A6A1F]" : undefined}>{due.text}</span>
            ) : null}
            {due && task.link ? " · " : null}
            {task.link ? task.link.name : null}
          </p>
          {busy ? <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">Saving</p> : null}
          {error ? (
            <p role="alert" className="mt-1 text-[12.5px] font-semibold text-[color:var(--color-state-error)]">
              Not saved. {error}
            </p>
          ) : null}
        </div>
        {onUnpin ? (
          <button
            type="button"
            onClick={onUnpin}
            disabled={busy}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-2 text-[12.5px] font-semibold text-amber-deep disabled:opacity-50"
          >
            <Pin size={14} strokeWidth={2} aria-hidden="true" />
            Unpin
          </button>
        ) : null}
      </div>
    </li>
  );
}

function AgendaRow({ item, tasks }: { item: AgendaItem; tasks: TaskListItem[] }) {
  const isWork = item.kind === "block" && item.blockType === "admin";
  const isProtected = item.kind === "block" && item.blockType === "personal";
  const recurSuffix =
    item.kind === "block" ? RECURS.find((r) => r.key === item.recur)?.suffix ?? "" : "";
  const time =
    item.end !== null ? formatRange(item.start, item.end) : formatMinutes(item.start, true);

  return (
    <li
      className={`rounded-[14px] px-3.5 py-2.5 ${
        isWork
          ? "border border-dashed border-[rgba(217,138,58,0.6)] bg-[rgba(217,138,58,0.06)]"
          : isProtected
            ? "border border-mist bg-mist/30"
            : "border border-[rgba(46,74,51,0.35)] bg-card"
      }`}
    >
      <p className="text-[12px] font-semibold text-[color:var(--color-text-muted)]">
        {time}
        {item.kind === "session" ? " · Booked session" : ""}
        {isProtected ? " · Protected" : ""}
        {recurSuffix ? ` ${recurSuffix}` : ""}
      </p>
      <p className="text-[14.5px] font-semibold text-forest-deep">{item.title}</p>
      {item.location ? (
        <p className="text-[12px] text-[color:var(--color-text-muted)]">{item.location}</p>
      ) : null}
      {isWork && tasks.length > 0 ? (
        <ul className="mt-1">
          {tasks.map((t) => (
            <li key={t.id} className="text-[12.5px] text-[color:var(--color-text)]">
              · {t.title}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TodayView({
  tasks,
  blocks,
  links,
  sessions,
}: {
  tasks: TaskListItem[];
  blocks: ScheduleBlock[];
  links: BlockTaskLink[];
  sessions: SessionRow[];
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayKey = now ? localDayKey(now) : null;
  const weekKey = now ? weekStartKey(now) : null;
  const { pinned, due } = useMemo(
    () => (todayKey ? selectTodayTasks(tasks, todayKey) : { pinned: [], due: [] }),
    [tasks, todayKey],
  );
  const agenda = useMemo(() => (now ? buildAgenda(blocks, sessions, now) : []), [blocks, sessions, now]);
  const next = now ? nextUp(agenda, now) : null;

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const blockTasks = (blockId: string) =>
    links
      .filter((l) => l.block_id === blockId && l.week_start === weekKey)
      .sort((a, b) => a.position - b.position)
      .map((l) => taskById.get(l.task_id))
      .filter((t): t is TaskListItem => Boolean(t) && t!.status !== "done" && t!.status !== "cancelled");

  function act(taskId: string, fn: () => Promise<{ error: string | null }>) {
    setBusyId(taskId);
    setErrors((e) => {
      const { [taskId]: _drop, ...rest } = e;
      return rest;
    });
    start(async () => {
      let res: { error: string | null };
      try {
        res = await fn();
      } catch {
        res = { error: "Check your connection and try again." };
      }
      if (res.error) setErrors((e) => ({ ...e, [taskId]: res.error as string }));
      else router.refresh();
      setBusyId(null);
    });
  }

  if (!now || !todayKey) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-[104px] animate-pulse rounded-[18px] bg-chrome/90" />
        <div className="h-40 animate-pulse rounded-[18px] bg-inset" />
      </div>
    );
  }

  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex max-w-[1100px] flex-col gap-4 md:grid md:grid-cols-2 md:items-start md:gap-5">
      <section className="rounded-[18px] bg-chrome px-5 py-[18px] text-bone md:col-span-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cream">{dateLine}</p>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-[25px] leading-tight">
          {next ? `Next: ${next.title} at ${formatMinutes(next.start, true)}` : "Nothing else on the schedule today."}
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <section
          aria-labelledby="today-pinned"
          className="rounded-[18px] border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
        >
          <h2 id="today-pinned" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
            Pinned for today
          </h2>
          {pinned.length > 0 ? (
            <ul className="mt-1">
              {pinned.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  todayKey={todayKey}
                  busy={busyId === t.id}
                  error={errors[t.id] ?? null}
                  onDone={() => act(t.id, () => setTaskDone(t.id, true))}
                  onUnpin={() => act(t.id, () => toggleTaskPin(t.id, false))}
                />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[13.5px] text-[color:var(--color-text-muted)]">
              Nothing pinned. Pin a task in{" "}
              <Link href="/tasks" className="font-semibold text-amber-deep">
                Tasks
              </Link>{" "}
              to keep it here.
            </p>
          )}
        </section>

        <section
          aria-labelledby="today-due"
          className="rounded-[18px] border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
        >
          <h2 id="today-due" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
            Due today or earlier
          </h2>
          {due.length > 0 ? (
            <ul className="mt-1">
              {due.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  todayKey={todayKey}
                  busy={busyId === t.id}
                  error={errors[t.id] ?? null}
                  onDone={() => act(t.id, () => setTaskDone(t.id, true))}
                />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[13.5px] text-[color:var(--color-text-muted)]">Nothing due today.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="today-schedule" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 id="today-schedule" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
            Today
          </h2>
          <Link href="/schedule" className="min-h-[44px] py-2.5 text-[12.5px] font-semibold text-amber-deep md:min-h-0 md:py-0">
            Open schedule
          </Link>
        </div>
        <p className="px-1 text-[12px] text-[color:var(--color-text-muted)]">Solid is fixed · dashed is work time</p>
        {agenda.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {agenda.map((item) => (
              <AgendaRow
                key={`${item.kind}:${item.id}`}
                item={item}
                tasks={item.kind === "block" && item.blockType === "admin" ? blockTasks(item.id) : []}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-[14px] border border-[color:var(--border-hair)] bg-card px-3.5 py-3 text-[13.5px] text-[color:var(--color-text-muted)]">
            Nothing on the schedule for today.
          </p>
        )}
      </section>
    </div>
  );
}
