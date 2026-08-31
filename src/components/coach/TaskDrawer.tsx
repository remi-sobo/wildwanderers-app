"use client";

// The task popout: click a task on /tasks and this drawer is its workspace.
// Details edit in place, the link chip jumps to the record the task is
// about, recurrence and assignment live here, and the comment thread keeps
// the running notes. Same drawer pattern as the lead popout.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Check, Pin, Send } from "lucide-react";
import {
  updateTask,
  setTaskDone,
  toggleTaskPin,
  addTaskComment,
} from "@/lib/tasks/actions";
import { PROGRAMS, PROGRAM_LABEL } from "@/lib/tasks/programs";
import type { TaskBucket, TaskListItem, TaskComment, StaffOption } from "@/lib/data/tasks";

const PRIORITIES = ["urgent", "high", "medium", "low"];
const RECURS: { value: string; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "monthly", label: "Monthly" },
];
const LINK_KIND_LABEL: Record<string, string> = {
  lead: "Lead",
  client: "Client",
  customer: "Customer",
  program: "Boys program",
};

const field =
  "h-11 md:h-10 w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber";
const label = "mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-bark";

export function TaskDrawer({
  task,
  buckets,
  comments,
  staff,
  onClose,
}: {
  task: TaskListItem;
  buckets: TaskBucket[];
  comments: TaskComment[];
  staff: StaffOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState("");

  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    // category rides along untouched; the UI stopped using it.
    category: task.category,
    program: task.program as string,
    bucket_id: task.bucket_id ?? "",
    priority: task.priority as string,
    due_date: task.due_date ?? "",
    assigned_to: task.assigned_to ?? "",
    recur: task.recur as string,
  });

  const bucketName = buckets.find((b) => b.id === task.bucket_id)?.name ?? null;
  const programBuckets = buckets.filter((b) => b.program === form.program);

  const done = task.status === "done";

  function run(fn: () => Promise<{ error: string | null }>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  function save() {
    run(
      () => updateTask(task.id, form),
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      },
    );
  }

  function sendComment() {
    if (!comment.trim()) return;
    run(
      () => addTaskComment(task.id, comment),
      () => setComment(""),
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close task" onClick={onClose} className="absolute inset-0 bg-[#1e1a12]/40" />
      <aside
        role="dialog"
        aria-label={task.title}
        className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-canvas shadow-[-8px_0_40px_rgba(42,33,24,0.18)]"
      >
        <div className="bg-chrome px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-display)] text-[20px] leading-tight text-bone">
                {task.title}
              </h2>
              <p className="mt-1 text-[12.5px] text-bone/65">
                {PROGRAM_LABEL[task.program]}
                {bucketName ? ` · ${bucketName}` : ""}
                <span className="capitalize"> · {task.priority}</span>
                {task.is_next_step ? " · next step" : ""}
                {task.source_type ? " · auto" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-bone/70 transition-colors hover:text-bone"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5">
          {error ? (
            <p role="alert" className="mb-3 text-[13px] text-[color:var(--color-state-error)]">{error}</p>
          ) : null}

          {/* State row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setTaskDone(task.id, !done))}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors max-md:min-h-[44px] ${
                done
                  ? "border border-[color:var(--border-strong)] text-ink hover:bg-inset"
                  : "bg-fern text-bone hover:bg-forest"
              }`}
            >
              <Check size={14} aria-hidden="true" /> {done ? "Reopen" : "Mark done"}
            </button>
            <button
              type="button"
              disabled={pending || done}
              onClick={() => run(() => toggleTaskPin(task.id, !task.pin_today))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors max-md:min-h-[44px] ${
                task.pin_today
                  ? "border-amber bg-amber/10 text-amber-deep"
                  : "border-[color:var(--border-strong)] text-ink hover:bg-inset"
              } disabled:opacity-50`}
            >
              <Pin size={13} fill={task.pin_today ? "currentColor" : "none"} aria-hidden="true" />
              {task.pin_today ? "Pinned for today" : "Pin for today"}
            </button>
            {task.link ? (
              <Link
                href={task.link.href}
                className="ww-link text-[13px] font-semibold text-forest max-md:min-h-[44px] max-md:inline-flex max-md:items-center"
              >
                {LINK_KIND_LABEL[task.link.kind]}: {task.link.name}
              </Link>
            ) : null}
          </div>

          {/* Details */}
          <section className="mt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className={label}>Title</span>
                <input className={field} value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <span className={label}>Notes on the task</span>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-[color:var(--border-strong)] bg-card p-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Program</span>
                <select className={field} value={form.program}
                  onChange={(e) => setForm({ ...form, program: e.target.value, bucket_id: "" })}>
                  {PROGRAMS.map((p) => <option key={p} value={p}>{PROGRAM_LABEL[p]}</option>)}
                </select>
              </div>
              <div>
                <span className={label}>Bucket</span>
                <select className={field} value={form.bucket_id}
                  onChange={(e) => setForm({ ...form, bucket_id: e.target.value })}>
                  <option value="">No bucket</option>
                  {programBuckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <span className={label}>Priority</span>
                <select className={`${field} capitalize`} value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <span className={label}>Due date</span>
                <input className={field} type="date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div>
                <span className={label}>Repeats</span>
                <select className={field} value={form.recur}
                  onChange={(e) => setForm({ ...form, recur: e.target.value })}>
                  {RECURS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {staff.length > 1 ? (
                <div>
                  <span className={label}>Assigned to</span>
                  <select className={field} value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={save}
                disabled={pending || !form.title.trim()}
                className="rounded-full bg-amber px-5 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
              >
                {saved ? "Saved" : pending ? "Saving" : "Save"}
              </button>
            </div>
          </section>

          {/* Comments */}
          <section className="mt-7">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">
              Comments{comments.length > 0 ? ` · ${comments.length}` : ""}
            </h3>
            {comments.length === 0 ? (
              <p className="text-[13px] text-[color:var(--color-text-muted)]">
                No comments yet. Keep the running notes here.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-xl border border-[color:var(--border-hair)] bg-card px-3.5 py-2.5">
                    <p className="whitespace-pre-wrap text-[13.5px] leading-[1.5] text-[color:var(--color-text)]">
                      {c.content}
                    </p>
                    <p className="mt-1 text-[11.5px] text-[color:var(--color-text-faint)]">
                      {c.author_name ?? "Staff"} ·{" "}
                      {new Date(c.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-start gap-2">
              <textarea
                rows={2}
                className="w-full rounded-lg border border-[color:var(--border-strong)] bg-card p-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber"
                placeholder="Add a comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendComment();
                }}
              />
              <button
                type="button"
                onClick={sendComment}
                disabled={pending || !comment.trim()}
                aria-label="Send comment"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-bone transition-colors hover:bg-forest-deep disabled:opacity-60 md:h-10 md:w-10"
              >
                <Send size={15} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
