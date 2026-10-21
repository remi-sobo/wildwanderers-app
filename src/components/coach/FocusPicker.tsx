"use client";

// A capped pick list over real tasks (specs/week.md), shared by My three
// (cap 3) and This Week's Five (cap 5). Choosing past the cap says so and
// changes nothing. Saving replaces the whole set at once; a failed save
// keeps the choice on screen and says "Not saved".

import { useState } from "react";
import { Check } from "lucide-react";
import type { TaskListItem } from "@/lib/data/tasks";
import { togglePick } from "@/lib/hq/week";

function dueText(due: string | null): string | null {
  if (!due) return null;
  const [y, m, d] = due.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FocusPicker({
  candidates,
  initial,
  cap,
  fullMessage,
  saveLabel,
  onSave,
  onCancel,
}: {
  candidates: TaskListItem[];
  initial: string[];
  cap: number;
  fullMessage: string;
  saveLabel: string;
  onSave: (ids: string[]) => Promise<{ error: string | null }>;
  onCancel: () => void;
}) {
  const [ids, setIds] = useState<string[]>(initial);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    let res: { error: string | null };
    try {
      res = await onSave(ids);
    } catch {
      res = { error: "Check your connection and try again." };
    }
    setSaving(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
        {ids.length} of {cap} picked. Tap to add or take off.
      </p>
      <ul className="max-h-[360px] overflow-y-auto rounded-xl border border-[color:var(--border-hair)]">
        {candidates.length === 0 ? (
          <li className="px-3 py-3 text-[13.5px] text-[color:var(--color-text-muted)]">No open tasks to pick from.</li>
        ) : (
          candidates.map((t) => {
            const picked = ids.includes(t.id);
            const order = ids.indexOf(t.id) + 1;
            const due = dueText(t.due_date);
            return (
              <li key={t.id} className="border-t border-[color:var(--border-hair)] first:border-t-0">
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => {
                    const next = togglePick(ids, t.id, cap);
                    if (!next) {
                      setNote(fullMessage);
                      return;
                    }
                    setNote(null);
                    setIds(next);
                  }}
                  className={`flex min-h-[48px] w-full items-center gap-3 px-3 py-2 text-left ${picked ? "bg-forest/5" : ""}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[12px] font-bold ${
                      picked ? "border-forest bg-forest text-bone" : "border-[color:var(--border-strong)] text-transparent"
                    }`}
                  >
                    {picked ? order : <Check size={14} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-forest-deep">{t.title}</span>
                    <span className="block text-[12px] text-[color:var(--color-text-muted)]">
                      {[t.pin_today ? "Pinned" : null, due ? `Due ${due}` : null, t.link?.name ?? null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {note ? <p className="text-[12.5px] font-semibold text-[#8A6A1F]">{note}</p> : null}
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-[color:var(--color-state-error)]">
          Not saved. {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex min-h-[44px] items-center rounded-full bg-amber px-5 text-[14px] font-semibold text-[#23170c] disabled:opacity-60"
        >
          {saving ? "Saving" : saveLabel}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--border-strong)] px-4 text-[13.5px] font-semibold text-forest-deep"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
