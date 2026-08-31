"use client";

// The Homework section on a client's profile: assign in one line (title,
// optional details, optional due date), see the list with status, and
// read completion notes as they land. Assigning takes seconds; the
// client sees it on their own Homework screen.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Circle, Plus, X } from "lucide-react";
import { assignHomework, removeHomework } from "@/lib/homework/actions";
import type { Homework } from "@/lib/data/homework";

const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber";

function shortDate(iso: string): string {
  return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function HomeworkPanel({
  clientId,
  firstName,
  items,
}: {
  clientId: string;
  firstName: string;
  items: Homework[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [form, setForm] = useState({ title: "", details_md: "", due_date: "" });

  function assign() {
    if (!form.title.trim()) return;
    setError(null);
    start(async () => {
      const res = await assignHomework(clientId, {
        title: form.title,
        details_md: form.details_md || undefined,
        due_date: form.due_date || undefined,
      });
      if (res.error) setError(res.error);
      else {
        setForm({ title: "", details_md: "", due_date: "" });
        setShowDetails(false);
        router.refresh();
      }
    });
  }

  function withdraw(id: string) {
    setError(null);
    start(async () => {
      const res = await removeHomework(id, clientId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
        Homework
      </h2>

      {/* Assign */}
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto]">
          <input
            className={field}
            placeholder={`Homework for ${firstName}, e.g. walk 20 minutes after dinner`}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") assign();
            }}
          />
          <input
            className={field}
            type="date"
            aria-label="Due date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          <button
            type="button"
            onClick={assign}
            disabled={pending || !form.title.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
          >
            <Plus size={15} aria-hidden="true" /> Assign
          </button>
        </div>
        {showDetails ? (
          <textarea
            rows={2}
            className="mt-2.5 w-full rounded-lg border border-[color:var(--border-strong)] bg-card p-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber"
            placeholder="Details, if the title needs them"
            value={form.details_md}
            onChange={(e) => setForm({ ...form, details_md: e.target.value })}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="mt-2 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest max-md:min-h-[44px]"
          >
            Add details
          </button>
        )}
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{error}</p>
        ) : null}
      </div>

      {/* The list */}
      {items.length === 0 ? (
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
          Nothing assigned yet. Give {firstName} one small thing to take home.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 shadow-[var(--shadow-card)]">
          {items.map((h) => {
            const done = h.status === "done";
            return (
              <li key={h.id} className="flex items-start gap-2.5 py-2.5">
                {done ? (
                  <CircleCheck size={19} className="mt-0.5 shrink-0 text-fern" aria-hidden="true" />
                ) : (
                  <Circle size={19} className="mt-0.5 shrink-0 text-[color:var(--color-text-faint)]" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] ${done ? "text-[color:var(--color-text-muted)]" : "text-forest-deep"}`}>
                    {h.title}
                  </p>
                  {h.details_md ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
                      {h.details_md}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11.5px] text-[color:var(--color-text-faint)]">
                    {done && h.completed_at
                      ? `Done ${shortDate(h.completed_at)}`
                      : `Assigned ${shortDate(h.assigned_at)}`}
                    {h.due_date ? ` · due ${shortDate(h.due_date)}` : ""}
                  </p>
                  {h.completion_note ? (
                    <p className="mt-1.5 rounded-xl bg-inset px-3 py-2 text-[13px] leading-[1.5] text-[color:var(--color-text)]">
                      &ldquo;{h.completion_note}&rdquo;
                    </p>
                  ) : null}
                </div>
                {!done ? (
                  <button
                    type="button"
                    onClick={() => withdraw(h.id)}
                    disabled={pending}
                    aria-label="Withdraw this homework"
                    title="Withdraw"
                    className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
