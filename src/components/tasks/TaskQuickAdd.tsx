"use client";

// Add a task from wherever you are standing. One shared control: an icon
// in the top bar (unlinked), and a labeled button on records (the lead
// drawer has its own inline adds). Whatever context it is given rides
// along as the task's link. Every add names a program and offers that
// program's buckets, loaded when the sheet opens.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, X } from "lucide-react";
import { addTask, listTaskBuckets } from "@/lib/tasks/actions";
import { PROGRAMS, PROGRAM_LABEL, type TaskProgram } from "@/lib/tasks/programs";

const PRIORITIES = ["urgent", "high", "medium", "low"];

const field =
  "h-11 md:h-10 w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber";

type BucketOption = { id: string; program: string; name: string };

export type TaskLinkContext = {
  lead_id?: string;
  client_id?: string;
  customer_id?: string;
  program_id?: string;
  /** What the link points at, shown in the sheet ("for Sara Brewer"). */
  label?: string;
  /** Default program when the context implies one. */
  program?: TaskProgram;
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
  const [buckets, setBuckets] = useState<BucketOption[] | null>(null);
  const [form, setForm] = useState({
    title: "",
    due_date: "",
    priority: "medium",
    program: (link?.program ?? "general") as TaskProgram,
    bucket_id: "",
  });

  useEffect(() => {
    if (!open || buckets !== null) return;
    let cancelled = false;
    listTaskBuckets().then((b) => {
      if (!cancelled) setBuckets(b);
    });
    return () => {
      cancelled = true;
    };
  }, [open, buckets]);

  const programBuckets = (buckets ?? []).filter((b) => b.program === form.program);

  function save() {
    if (!form.title.trim()) return;
    setError(null);
    start(async () => {
      const res = await addTask({
        title: form.title,
        due_date: form.due_date || undefined,
        priority: form.priority,
        program: form.program,
        bucket_id: form.bucket_id || undefined,
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
              <div className="grid grid-cols-2 gap-2.5">
                <select className={field} aria-label="Program" value={form.program}
                  onChange={(e) => setForm({ ...form, program: e.target.value as TaskProgram, bucket_id: "" })}>
                  {PROGRAMS.map((p) => <option key={p} value={p}>{PROGRAM_LABEL[p]}</option>)}
                </select>
                <select className={field} aria-label="Bucket" value={form.bucket_id}
                  onChange={(e) => setForm({ ...form, bucket_id: e.target.value })}>
                  <option value="">No bucket</option>
                  {programBuckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input className={field} type="date" aria-label="Due date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                <select className={`${field} capitalize`} aria-label="Priority" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
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
