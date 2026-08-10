"use client";

// The lead popout: click a card on the pipeline board and this drawer is the
// lead's whole workspace. Details and notes edit in place, the stage and the
// big moves (convert, mark lost) live at the top, tasks that belong to the
// lead sit beside a quick add, and the timeline logs every touch. The board
// stays the map; this panel is where the lead gets worked.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  UserPlus,
  Phone,
  Mail,
  MessageSquare,
  Users,
  StickyNote,
  ArrowRightLeft,
  Plus,
  Check,
} from "lucide-react";
import {
  updateLead,
  moveLeadStage,
  markLeadLost,
  convertLeadToCustomer,
  logLeadActivity,
  addTask,
  setTaskDone,
} from "@/lib/business/actions";
import { formatMoney } from "@/lib/business/format";
import type { Lead, LeadStage, LeadActivity, BusinessTask } from "@/lib/data/business";

const STAGES: { value: LeadStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "engaged", label: "Engaged" },
  { value: "trial", label: "Trial" },
  { value: "proposal", label: "Proposal" },
  { value: "nurture", label: "Nurture" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];
const SOURCES = ["website", "referral", "walk_in", "social", "other"];
const INTERESTS = ["one_on_one", "small_group", "wellness", "boys_program", "other"];

const TOUCH_KINDS: { value: string; label: string; icon: typeof Phone }[] = [
  { value: "call", label: "Call", icon: Phone },
  { value: "text", label: "Text", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "in_person", label: "In person", icon: Users },
  { value: "note", label: "Note", icon: StickyNote },
];

const field =
  "h-11 md:h-10 w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber";
const label = "mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-bark";
const sectionHead = "mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-bark";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function shortDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadDrawer({
  lead,
  activities,
  tasks,
  onClose,
}: {
  lead: Lead;
  activities: LeadActivity[];
  tasks: BusinessTask[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Editable copy of the details; the drawer is keyed by lead.id so this
  // reinitializes when a different lead opens.
  const [form, setForm] = useState({
    name: lead.name,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: lead.source,
    interest: lead.interest ?? "",
    estimated_value: lead.estimated_value_cents != null ? String(lead.estimated_value_cents / 100) : "",
    next_action: lead.next_action ?? "",
    next_action_date: lead.next_action_date ?? "",
    notes: lead.notes ?? "",
  });
  const [saved, setSaved] = useState(false);

  const [touchKind, setTouchKind] = useState("call");
  const [touchText, setTouchText] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState("");

  const closed = lead.stage === "won" || lead.stage === "lost";
  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

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

  function saveDetails() {
    run(
      () => updateLead(lead.id, form),
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      },
    );
  }

  function logTouch() {
    if (!touchText.trim()) return;
    run(
      () => logLeadActivity(lead.id, touchKind, touchText),
      () => setTouchText(""),
    );
  }

  function addLeadTask() {
    if (!taskTitle.trim()) return;
    run(
      () =>
        addTask({
          title: taskTitle,
          category: "sales",
          due_date: taskDue || undefined,
          lead_id: lead.id,
        }),
      () => {
        setTaskTitle("");
        setTaskDue("");
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close lead"
        onClick={onClose}
        className="absolute inset-0 bg-[#1e1a12]/40"
      />
      <aside
        role="dialog"
        aria-label={lead.name}
        className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-canvas shadow-[-8px_0_40px_rgba(42,33,24,0.18)]"
      >
        {/* Header */}
        <div className="bg-chrome px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-[family-name:var(--font-display)] text-[22px] leading-tight text-bone">
                {lead.name}
              </h2>
              <p className="mt-1 text-[12.5px] text-bone/65">
                {lead.interest ? lead.interest.replace(/_/g, " ") : "no interest set"} ·{" "}
                {lead.source.replace("_", " ")}
                {lead.estimated_value_cents != null
                  ? ` · ${formatMoney(lead.estimated_value_cents)}`
                  : ""}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5">
          {error ? (
            <p role="alert" className="mb-3 text-[13px] text-[color:var(--color-state-error)]">
              {error}
            </p>
          ) : null}

          {/* Stage and the big moves */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={lead.stage}
              disabled={pending}
              onChange={(e) => run(() => moveLeadStage(lead.id, e.target.value as LeadStage))}
              className="h-11 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[16px] text-ink md:h-9 md:text-[13px]"
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {!lead.customer_id && lead.stage !== "lost" ? (
              <button
                type="button"
                onClick={() => run(() => convertLeadToCustomer(lead.id))}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-1.5 text-[13px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-60 max-md:min-h-[44px]"
              >
                <UserPlus size={13} aria-hidden="true" /> Convert to customer
              </button>
            ) : lead.customer_id ? (
              <span className="text-[12.5px] font-semibold text-fern">Customer</span>
            ) : null}
            {!closed && !losing ? (
              <button
                type="button"
                onClick={() => setLosing(true)}
                className="ww-link text-[13px] font-semibold text-[color:var(--color-text-muted)] max-md:min-h-[44px]"
              >
                Mark lost
              </button>
            ) : null}
          </div>
          {lead.stage === "lost" && lead.lost_reason ? (
            <p className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
              Lost: {lead.lost_reason}
            </p>
          ) : null}
          {losing ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                className={field}
                placeholder="Why was it lost?"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => markLeadLost(lead.id, lostReason),
                    () => setLosing(false),
                  )
                }
                className="shrink-0 rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:bg-inset max-md:min-h-[44px]"
              >
                Mark lost
              </button>
              <button
                type="button"
                onClick={() => setLosing(false)}
                className="ww-link shrink-0 text-[13px] font-semibold text-forest max-md:min-h-[44px]"
              >
                Keep
              </button>
            </div>
          ) : null}

          {/* Details */}
          <section className="mt-6">
            <h3 className={sectionHead}>Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className={label}>Name</span>
                <input className={field} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <span className={label}>Email</span>
                <input className={field} value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <span className={label}>Phone</span>
                <input className={field} value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <span className={label}>Source</span>
                <select className={`${field} capitalize`} value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Interest</span>
                <select className={`${field} capitalize`} value={form.interest}
                  onChange={(e) => setForm({ ...form, interest: e.target.value })}>
                  <option value="">Not set</option>
                  {INTERESTS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Estimated value $</span>
                <input className={field} inputMode="decimal" value={form.estimated_value}
                  onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
              </div>
              <div>
                <span className={label}>Next action date</span>
                <input className={field} type="date" value={form.next_action_date}
                  onChange={(e) => setForm({ ...form, next_action_date: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <span className={label}>Next action</span>
                <input className={field} placeholder="e.g. call Thursday about small group"
                  value={form.next_action}
                  onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <span className={label}>Notes</span>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-[color:var(--border-strong)] bg-card p-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber"
                  placeholder="Anything worth remembering about this person"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={saveDetails}
                disabled={pending || !form.name.trim()}
                className="rounded-full bg-amber px-5 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
              >
                {saved ? "Saved" : pending ? "Saving" : "Save details"}
              </button>
            </div>
          </section>

          {/* Tasks */}
          <section className="mt-7">
            <h3 className={sectionHead}>
              Tasks{" "}
              {openTasks.length > 0 ? (
                <span className="text-[color:var(--color-text-faint)]">· {openTasks.length} open</span>
              ) : null}
            </h3>
            {tasks.length === 0 ? (
              <p className="text-[13px] text-[color:var(--color-text-muted)]">
                Nothing yet. Add the next thing to do for this lead.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {[...openTasks, ...doneTasks].map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setTaskDone(t.id, t.status !== "done"))}
                      aria-label={t.status === "done" ? "Reopen task" : "Mark task done"}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors max-md:h-7 max-md:w-7 ${
                        t.status === "done"
                          ? "border-fern bg-fern text-bone"
                          : "border-[color:var(--border-strong)] bg-card hover:border-fern"
                      }`}
                    >
                      {t.status === "done" ? <Check size={13} aria-hidden="true" /> : null}
                    </button>
                    <span
                      className={`min-w-0 flex-1 truncate text-[14px] ${
                        t.status === "done"
                          ? "text-[color:var(--color-text-faint)] line-through"
                          : "text-ink"
                      }`}
                    >
                      {t.title}
                    </span>
                    {t.due_date ? (
                      <span className="shrink-0 text-[12px] text-[color:var(--color-text-muted)]">
                        {shortDate(t.due_date)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center gap-2">
              <input
                className={field}
                placeholder="Add a task for this lead"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLeadTask();
                }}
              />
              <input
                className={`${field} w-auto shrink-0`}
                type="date"
                aria-label="Due date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
              <button
                type="button"
                onClick={addLeadTask}
                disabled={pending || !taskTitle.trim()}
                aria-label="Add task"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-strong)] text-forest transition-colors hover:bg-inset disabled:opacity-60 md:h-10 md:w-10"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </section>

          {/* Timeline */}
          <section className="mt-7">
            <h3 className={sectionHead}>Timeline</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TOUCH_KINDS.map((k) => {
                const Icon = k.icon;
                const active = touchKind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setTouchKind(k.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors max-md:min-h-[40px] ${
                      active
                        ? "border-amber bg-amber/10 text-ink"
                        : "border-[color:var(--border-hair)] text-[color:var(--color-text-muted)] hover:border-[color:var(--border-strong)]"
                    }`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {k.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                className="w-full rounded-lg border border-[color:var(--border-strong)] bg-card p-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber"
                placeholder="What happened on this touch?"
                value={touchText}
                onChange={(e) => setTouchText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") logTouch();
                }}
              />
              <button
                type="button"
                onClick={logTouch}
                disabled={pending || !touchText.trim()}
                className="shrink-0 rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
              >
                Log
              </button>
            </div>

            {activities.length === 0 ? (
              <p className="mt-3 text-[13px] text-[color:var(--color-text-muted)]">
                No touches logged yet. Stage moves land here on their own.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {activities.map((a) => {
                  const isStage = a.kind === "stage_change";
                  const found = TOUCH_KINDS.find((k) => k.value === a.kind);
                  const Icon = isStage ? ArrowRightLeft : found?.icon ?? StickyNote;
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                          isStage
                            ? "border-[color:var(--border-hair)] text-[color:var(--color-text-faint)]"
                            : "border-[color:var(--border-strong)] bg-card text-forest"
                        }`}
                      >
                        <Icon size={13} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-[13.5px] leading-[1.5] ${
                            isStage
                              ? "text-[color:var(--color-text-muted)]"
                              : "text-[color:var(--color-text)]"
                          }`}
                        >
                          {a.content || (found?.label ?? a.kind)}
                        </p>
                        <p className="text-[11.5px] text-[color:var(--color-text-faint)]">
                          {isStage ? "Stage" : found?.label ?? a.kind} · {shortDateTime(a.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
