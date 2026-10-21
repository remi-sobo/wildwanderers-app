"use client";

// From your advisor (specs/advisor.md), above the owner's task board:
// suggestions waiting on a yes, and recent assignments. A suggestion
// becomes a task only when accepted; "Not now" sets it aside and the
// advisor sees that. Assignments are ordinary tasks and are also in the
// full list below. A row changes only after its save succeeds.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptSuggestion, declineSuggestion } from "@/lib/advisor/owner-actions";
import type { FromAdvisorTask, SharedAdvisorItem } from "@/lib/data/advisor-owner";

function dueText(due: string | null): string | null {
  if (!due) return null;
  const [y, m, d] = due.slice(0, 10).split("-").map(Number);
  return `Due ${new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function FromAdvisor({ items, shared = [] }: { items: FromAdvisorTask[]; shared?: SharedAdvisorItem[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (items.length === 0 && shared.length === 0) return null;

  function act(id: string, fn: () => Promise<{ error: string | null }>) {
    setBusy(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    start(async () => {
      let res: { error: string | null };
      try {
        res = await fn();
      } catch {
        res = { error: "Check your connection and try again." };
      }
      if (res.error) setErrors((e) => ({ ...e, [id]: res.error as string }));
      else router.refresh();
      setBusy(null);
    });
  }

  return (
    <section
      aria-labelledby="from-advisor"
      className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
    >
      <h2 id="from-advisor" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
        From your advisor
      </h2>
      <ul className="mt-1">
        {items.map((t) => {
          const due = dueText(t.due_date);
          return (
            <li key={t.id} className="border-t border-[color:var(--border-hair)] py-3 first:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-bark">
                    {t.kind === "suggestion" ? "Suggestion" : "Assigned"} · {t.advisor_name}
                  </p>
                  <p className="text-[15px] font-semibold text-forest-deep">{t.title}</p>
                  {t.description ? (
                    <p className="mt-0.5 whitespace-pre-line text-[13px] text-[color:var(--color-text)]">{t.description}</p>
                  ) : null}
                  {due ? <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">{due}</p> : null}
                </div>
                {t.kind === "suggestion" ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy === t.id}
                      onClick={() => act(t.id, () => acceptSuggestion(t.id))}
                      className="inline-flex min-h-[44px] items-center rounded-full bg-amber px-4 text-[13px] font-semibold text-[#23170c] disabled:opacity-60 md:min-h-[36px]"
                    >
                      Add to my tasks
                    </button>
                    <button
                      type="button"
                      disabled={busy === t.id}
                      onClick={() => act(t.id, () => declineSuggestion(t.id))}
                      className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--border-strong)] px-4 text-[13px] font-semibold text-forest-deep disabled:opacity-60 md:min-h-[36px]"
                    >
                      Not now
                    </button>
                  </div>
                ) : null}
              </div>
              {busy === t.id ? <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">Saving</p> : null}
              {errors[t.id] ? (
                <p role="alert" className="mt-1 text-[12.5px] font-semibold text-[color:var(--color-state-error)]">
                  Not saved. {errors[t.id]}
                </p>
              ) : null}
            </li>
          );
        })}
        {shared.map((s) => {
          const due = dueText(s.due_date);
          return (
            <li key={s.id} className="border-t border-[color:var(--border-hair)] py-3 first:border-t-0">
              <p className="text-[12px] font-semibold text-bark">
                {s.kind === "question" ? "Question" : "Ready for you"} · {s.advisor_name}
              </p>
              <p className="text-[15px] font-semibold text-forest-deep">{s.title}</p>
              {s.notes ? <p className="mt-0.5 whitespace-pre-line text-[13px] text-[color:var(--color-text)]">{s.notes}</p> : null}
              <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                {due ? `${due} · ` : ""}Reply to {s.advisor_name} directly. It clears when they mark it done.
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
