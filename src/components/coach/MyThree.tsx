"use client";

// My three (specs/week.md), on Today: up to three real tasks picked for
// this local day. Not the same as a pin. Yesterday's open picks show as
// From yesterday to pick again, never carried over silently. Checking
// one off goes through the task system, so it is done everywhere.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { setTaskDone } from "@/lib/tasks/actions";
import { setDayFocus } from "@/lib/hq/week-actions";
import type { TaskListItem } from "@/lib/data/tasks";
import { focusCandidates, stillOpen } from "@/lib/hq/week";
import { FocusPicker } from "@/components/coach/FocusPicker";

const FULL = "Today already has three. Take one off first.";

export function MyThree({
  tasks,
  todayKey,
  todayIds,
  yesterdayIds,
  fiveIds,
}: {
  tasks: TaskListItem[];
  todayKey: string;
  todayIds: string[];
  yesterdayIds: string[];
  fiveIds: string[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const picked = todayIds.map((id) => byId.get(id)).filter((t): t is TaskListItem => Boolean(t));
  const doneCount = picked.filter((t) => t.status === "done").length;
  const fromYesterday = stillOpen(yesterdayIds, tasks, todayIds);

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

  return (
    <section
      aria-labelledby="my-three"
      className="rounded-[18px] border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="my-three" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
          My three
        </h2>
        <span className="text-[12.5px] text-[color:var(--color-text-muted)]">
          {picked.length > 0 && doneCount === picked.length
            ? `You finished all ${picked.length === 3 ? "three" : picked.length}.`
            : doneCount > 0
              ? `${doneCount} done`
              : ""}
        </span>
      </div>

      {picking ? (
        <div className="mt-2">
          <FocusPicker
            candidates={focusCandidates(tasks, todayKey, fiveIds)}
            initial={todayIds.filter((id) => byId.get(id)?.status !== "done")}
            cap={3 - doneCount}
            fullMessage={FULL}
            saveLabel="Save today's three"
            onCancel={() => setPicking(false)}
            onSave={async (ids) => {
              // Keep finished picks on the day; they still count.
              const done = todayIds.filter((id) => byId.get(id)?.status === "done");
              const all = [...done, ...ids.filter((id) => !done.includes(id))];
              const res = await setDayFocus(todayKey, all);
              if (!res.error) {
                setPicking(false);
                router.refresh();
              }
              return res;
            }}
          />
        </div>
      ) : (
        <>
          {picked.length > 0 ? (
            <ul className="mt-1">
              {picked.map((t) => {
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
                      <Link
                        href={t.link?.href ?? "/tasks"}
                        className={`block text-[15.5px] font-semibold leading-snug hover:underline ${done ? "text-[color:var(--color-text-muted)] line-through" : "text-forest-deep"}`}
                      >
                        {t.title}
                      </Link>
                      {t.link ? <p className="text-[12.5px] text-[color:var(--color-text-muted)]">{t.link.name}</p> : null}
                      {busy === t.id ? <p className="text-[12px] text-[color:var(--color-text-muted)]">Saving</p> : null}
                      {errors[t.id] ? (
                        <p role="alert" className="text-[12.5px] font-semibold text-[color:var(--color-state-error)]">
                          Not saved. {errors[t.id]}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-3 text-[13.5px] text-[color:var(--color-text-muted)]">
              Nothing picked for today. Pull one from the week.
            </p>
          )}

          {fromYesterday.length > 0 ? (
            <div className="mt-1 border-t border-[color:var(--border-hair)] pt-2">
              <p className="text-[12px] font-semibold text-bark">From yesterday</p>
              <ul className="mt-1 flex flex-col gap-1">
                {fromYesterday.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[14px] text-forest-deep">{t.title}</span>
                    <button
                      type="button"
                      disabled={busy === `y:${t.id}`}
                      onClick={() => {
                        if (todayIds.length >= 3) {
                          setErrors((e) => ({ ...e, [`y:${t.id}`]: FULL }));
                          return;
                        }
                        act(`y:${t.id}`, () => setDayFocus(todayKey, [...todayIds, t.id]));
                      }}
                      className="min-h-[44px] shrink-0 px-2 text-[12.5px] font-semibold text-amber-deep md:min-h-0"
                    >
                      Pick again
                    </button>
                  </li>
                ))}
              </ul>
              {fromYesterday.map((t) =>
                errors[`y:${t.id}`] ? (
                  <p key={t.id} role="alert" className="text-[12.5px] font-semibold text-[#8A6A1F]">
                    {errors[`y:${t.id}`]}
                  </p>
                ) : null,
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-1 min-h-[44px] text-[13px] font-semibold text-amber-deep"
          >
            {picked.length > 0 ? "Change today's three" : "Pick today's three"}
          </button>
        </>
      )}
    </section>
  );
}
