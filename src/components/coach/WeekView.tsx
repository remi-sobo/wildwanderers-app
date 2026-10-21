"use client";

// Week (specs/week.md): This Week's Five, from real tasks. An empty week
// offers a starting five to edit, never a decision made for the owner.
// Last week's open five show as From last week to carry or let go.
// Below, the rest of what is due this week, and the schedule. The week is
// the viewer's local Monday, read after mount like Today and Schedule.

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { setTaskDone } from "@/lib/tasks/actions";
import { setWeekFive } from "@/lib/hq/week-actions";
import type { TaskListItem } from "@/lib/data/tasks";
import type { WeekPick } from "@/lib/data/week";
import { weekStartKey } from "@/lib/schedule/blocks";
import { localDayKey } from "@/lib/hq/business-home";
import { addDays, focusCandidates, stillOpen, suggestFive } from "@/lib/hq/week";
import { FocusPicker } from "@/components/coach/FocusPicker";

const FULL = "The week already has five. Take one off first.";
const LET_GO_KEY = "ww.hq.letGo";

function dayText(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WeekView({ tasks, weeks }: { tasks: TaskListItem[]; weeks: WeekPick[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [keys, setKeys] = useState<{ today: string; week: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [letGo, setLetGo] = useState<string[]>([]);

  useEffect(() => {
    const now = new Date();
    const week = weekStartKey(now);
    setKeys({ today: localDayKey(now), week });
    try {
      const saved = JSON.parse(window.localStorage.getItem(LET_GO_KEY) ?? "{}") as Record<string, string[]>;
      setLetGo(Array.isArray(saved[week]) ? saved[week] : []);
    } catch {
      // Storage blocked: nothing let go on this device yet.
    }
  }, []);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  if (!keys) {
    return <div className="h-48 animate-pulse rounded-[18px] bg-inset" aria-busy="true" />;
  }

  const fiveIds = weeks.filter((w) => w.week_start === keys.week).map((w) => w.task_id);
  const lastIds = weeks.filter((w) => w.week_start === addDays(keys.week, -7)).map((w) => w.task_id);
  const five = fiveIds.map((id) => byId.get(id)).filter((t): t is TaskListItem => Boolean(t));
  const suggested = five.length === 0 ? suggestFive(tasks, keys.today, keys.week) : [];
  const fromLastWeek = stillOpen(lastIds, tasks, fiveIds).filter((t) => !letGo.includes(t.id));
  const weekEnd = addDays(keys.week, 6);
  const restOfWeek = tasks
    .filter(
      (t) =>
        (t.status === "open" || t.status === "in_progress") &&
        t.due_date &&
        t.due_date.slice(0, 10) <= weekEnd &&
        !fiveIds.includes(t.id),
    )
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  function act(key: string, fn: () => Promise<{ error: string | null }>) {
    setBusy(key);
    setErrors((e) => ({ ...e, [key]: "" }));
    start(async () => {
      let res: { error: string | null };
      try {
        res = await fn();
      } catch {
        res = { error: "Check your connection and try again." };
      }
      if (res.error) setErrors((e) => ({ ...e, [key]: res.error as string }));
      else router.refresh();
      setBusy(null);
    });
  }

  function rememberLetGo(id: string) {
    if (!keys) return;
    const next = [...letGo, id];
    setLetGo(next);
    try {
      // Only this week matters; older weeks are dropped.
      window.localStorage.setItem(LET_GO_KEY, JSON.stringify({ [keys.week]: next }));
    } catch {
      // Not remembered on this device; it shows again next visit.
    }
  }

  const err = (key: string) =>
    errors[key] ? (
      <p role="alert" className="text-[12.5px] font-semibold text-[color:var(--color-state-error)]">
        Not saved. {errors[key]}
      </p>
    ) : null;

  return (
    <div className="flex max-w-[1100px] flex-col gap-4 md:grid md:grid-cols-2 md:items-start md:gap-5">
      <div className="md:col-span-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
          Week of {dayText(keys.week)}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] font-medium leading-tight text-forest-deep">
          This week
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <section
          aria-labelledby="the-five"
          className="rounded-[18px] border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
        >
          <h2 id="the-five" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
            This Week&apos;s Five
          </h2>

          {picking ? (
            <div className="mt-2">
              <FocusPicker
                candidates={focusCandidates(tasks, keys.today, fiveIds)}
                initial={fiveIds}
                cap={5}
                fullMessage={FULL}
                saveLabel="Save the five"
                onCancel={() => setPicking(false)}
                onSave={async (ids) => {
                  const res = await setWeekFive(keys.week, ids);
                  if (!res.error) {
                    setPicking(false);
                    router.refresh();
                  }
                  return res;
                }}
              />
            </div>
          ) : five.length > 0 ? (
            <>
              <ol className="mt-1">
                {five.map((t, i) => {
                  const done = t.status === "done";
                  return (
                    <li key={t.id} className="flex items-start gap-3 border-t border-[color:var(--border-hair)] py-3 first:border-t-0">
                      <button
                        type="button"
                        disabled={busy === t.id}
                        onClick={() => act(t.id, () => setTaskDone(t.id, !done))}
                        aria-label={done ? `Reopen "${t.title}"` : `Mark "${t.title}" done`}
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] ${
                          done ? "border-fern bg-fern text-bone" : "border-[color:var(--border-strong)] bg-card text-transparent hover:text-fern"
                        } disabled:opacity-50`}
                      >
                        <Check size={17} strokeWidth={2.25} aria-hidden="true" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-bark">{i + 1}</p>
                        <Link
                          href={t.link?.href ?? "/tasks"}
                          className={`block text-[15.5px] font-semibold leading-snug hover:underline ${done ? "text-[color:var(--color-text-muted)] line-through" : "text-forest-deep"}`}
                        >
                          {t.title}
                        </Link>
                        <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                          {[t.due_date ? `Due ${dayText(t.due_date.slice(0, 10))}` : null, t.link?.name ?? null].filter(Boolean).join(" · ")}
                        </p>
                        {busy === t.id ? <p className="text-[12px] text-[color:var(--color-text-muted)]">Saving</p> : null}
                        {err(t.id)}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <button type="button" onClick={() => setPicking(true)} className="min-h-[44px] text-[13px] font-semibold text-amber-deep">
                Change the five
              </button>
            </>
          ) : suggested.length > 0 ? (
            <div className="mt-1">
              <p className="text-[13px] text-[color:var(--color-text-muted)]">
                A starting five from what is overdue, pinned, assigned and due this week. Change any of it.
              </p>
              <ol className="mt-2 flex flex-col gap-1">
                {suggested.map((t, i) => (
                  <li key={t.id} className="text-[14.5px] text-forest-deep">
                    <span className="mr-1.5 text-[12px] font-semibold text-bark">{i + 1}</span>
                    {t.title}
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === "use"}
                  onClick={() => act("use", () => setWeekFive(keys.week, suggested.map((t) => t.id)))}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-amber px-5 text-[14px] font-semibold text-[#23170c] disabled:opacity-60"
                >
                  {busy === "use" ? "Saving" : "Use these"}
                </button>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--border-strong)] px-4 text-[13.5px] font-semibold text-forest-deep"
                >
                  Pick my own
                </button>
              </div>
              {err("use")}
            </div>
          ) : (
            <div className="py-2">
              <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Nothing picked for this week yet.</p>
              <button type="button" onClick={() => setPicking(true)} className="mt-1 min-h-[44px] text-[13px] font-semibold text-amber-deep">
                Pick this week&apos;s five
              </button>
            </div>
          )}
        </section>

        {fromLastWeek.length > 0 ? (
          <section
            aria-labelledby="from-last-week"
            className="rounded-[18px] border border-dashed border-[color:var(--border-strong)] px-4 py-3"
          >
            <h2 id="from-last-week" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
              From last week
            </h2>
            <ul className="mt-1">
              {fromLastWeek.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border-hair)] py-2 first:border-t-0">
                  <span className="min-w-0 text-[14.5px] text-forest-deep">{t.title}</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy === `c:${t.id}`}
                      onClick={() => {
                        if (fiveIds.length >= 5) {
                          setErrors((e) => ({ ...e, [`c:${t.id}`]: FULL }));
                          return;
                        }
                        act(`c:${t.id}`, () => setWeekFive(keys.week, [...fiveIds, t.id]));
                      }}
                      className="min-h-[44px] px-2 text-[12.5px] font-semibold text-amber-deep md:min-h-0"
                    >
                      Carry to this week
                    </button>
                    <button
                      type="button"
                      onClick={() => rememberLetGo(t.id)}
                      className="min-h-[44px] px-2 text-[12.5px] font-semibold text-[color:var(--color-text-muted)] md:min-h-0"
                    >
                      Let it go
                    </button>
                  </span>
                  {errors[`c:${t.id}`] ? (
                    <p role="alert" className="w-full text-[12.5px] font-semibold text-[#8A6A1F]">
                      {errors[`c:${t.id}`]}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
              Letting it go only takes it off this list. The task stays in Tasks.
            </p>
          </section>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <section
          aria-labelledby="rest-of-week"
          className="rounded-[18px] border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
        >
          <h2 id="rest-of-week" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
            Also due this week
          </h2>
          {restOfWeek.length > 0 ? (
            <ul className="mt-1">
              {restOfWeek.map((t) => {
                const due = t.due_date!.slice(0, 10);
                return (
                  <li key={t.id} className="border-t border-[color:var(--border-hair)] py-2 first:border-t-0">
                    <Link href={t.link?.href ?? "/tasks"} className="block text-[14.5px] text-forest-deep hover:underline">
                      {t.title}
                    </Link>
                    <p className={`text-[12px] ${due < keys.today ? "font-semibold text-[#8A6A1F]" : "text-[color:var(--color-text-muted)]"}`}>
                      {due < keys.today ? `Overdue, was ${dayText(due)}` : `Due ${dayText(due)}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-3 text-[13.5px] text-[color:var(--color-text-muted)]">Nothing else due this week.</p>
          )}
        </section>

        <Link
          href="/schedule"
          className="flex min-h-[52px] items-center justify-between rounded-[18px] border border-[color:var(--border-hair)] bg-card px-4 py-3 text-[14.5px] font-semibold text-forest-deep"
        >
          The week&apos;s schedule
          <span aria-hidden="true" className="text-[color:var(--color-text-faint)]">›</span>
        </Link>
      </div>
    </div>
  );
}
