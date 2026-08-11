"use client";

// Add a task from wherever you are standing. One shared control: an icon
// in the top bar (unlinked), and a labeled button on records (the lead
// drawer has its own inline adds). Whatever context it is given rides
// along as the task's link, and the task lands on /tasks.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, X } from "lucide-react";
import { addTask } from "@/lib/tasks/actions";

const PRIORITIES = ["urgent", "high", "medium", "low"];
const CATEGORIES = ["sales", "coaching", "program", "finance", "admin", "other"];

const field =
  "h-11 md:h-10 w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber";

export type TaskLinkContext = {
  lead_id?: string;
  client_id?: string;
  customer_id?: string;
  program_id?: string;
  /** What the link points at, shown in the sheet ("for Sara Brewer"). */
  label?: string;
  /** Default category when the context implies one. */
  category?: string;
};

export function TaskQuickAdd({
  variant = "button",
  link,
}: {
  variant?: "icon" | "button";
  link?: TaskLinkContext;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    due_date: "",
    priority: "medium",
    category: link?.category ?? "other",
  });

  function save() {
    if (!form.title.trim()) return;
    setError(null);
    start(async () => {
      const res = await addTask({
        title: form.title,
        due_date: form.due_date || undefined,
        priority: form.priority,
        category: form.category,
        lead_id: link?.lead_id,
        client_id: link?.client_id,
        customer_id: link?.customer_id,
        program_id: link?.program_id,
      });
      if (res.error) setError(res.error);
      else {
        setForm({ ...form, title: "", due_date: "" });
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Add a task"
          title="Add a task"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-forest transition-colors hover:bg-inset md:h-10 md:w-10"
        >
          <ListChecks size={19} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset max-md:min-h-[44px]"
        >
          <Plus size={13} aria-hidden="true" /> Add a task
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#1e1a12]/40"
          />
          <div className="relative w-full max-w-md rounded-t-2xl bg-canvas p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(42,33,24,0.18)] sm:rounded-2xl sm:pb-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
                  Add a task
                </h2>
                {link?.label ? (
                  <p className="text-[12.5px] text-[color:var(--color-text-muted)]">for {link.label}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-m-2 flex h-11 w-11 items-center justify-center text-[color:var(--color-text-muted)] hover:text-ink"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              <input
                autoFocus
                className={field}
                placeholder="What needs doing?"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
              />
              <div className="grid grid-cols-3 gap-2.5">
                <input className={field} type="date" aria-label="Due date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                <select className={`${field} capitalize`} aria-label="Priority" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className={`${field} capitalize`} aria-label="Category" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {error ? (
                <p role="alert" className="text-[13px] text-[color:var(--color-state-error)]">{error}</p>
              ) : null}
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={save}
                  disabled={pending || !form.title.trim()}
                  className="rounded-full bg-amber px-5 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
                >
                  {pending ? "Saving" : "Add task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
