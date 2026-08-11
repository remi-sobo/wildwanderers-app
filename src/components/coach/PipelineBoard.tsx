"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ListChecks, UserPlus } from "lucide-react";
import { addLead, addCustomerToRoster, type LeadInput } from "@/lib/business/actions";
import { formatMoney } from "@/lib/business/format";
import { LeadDrawer } from "@/components/coach/LeadDrawer";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import type { Lead, LeadStage, Customer, LeadWorkspace } from "@/lib/data/business";
import type { Task } from "@/lib/data/tasks";

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
const ORDER = STAGES.map((s) => s.value);
const SOURCES = ["website", "referral", "walk_in", "social", "other"];
const INTERESTS = ["one_on_one", "small_group", "wellness", "boys_program", "other"];
const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

function AddLead() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<LeadInput>({ name: "", source: "website" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await addLead(v);
      if (res.error) setError(res.error);
      else {
        setV({ name: "", source: "website" });
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep max-md:min-h-[44px]"
      >
        <Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Add lead
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="eyebrow mb-3 text-bark">New lead</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={`${field} sm:col-span-2`} placeholder="Name" value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })} />
        <input className={field} placeholder="Email" value={v.email ?? ""}
          onChange={(e) => setV({ ...v, email: e.target.value })} />
        <input className={field} placeholder="Phone" value={v.phone ?? ""}
          onChange={(e) => setV({ ...v, phone: e.target.value })} />
        <select className={`${field} capitalize`} value={v.source}
          onChange={(e) => setV({ ...v, source: e.target.value })}>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select className={`${field} capitalize`} value={v.interest ?? ""}
          onChange={(e) => setV({ ...v, interest: e.target.value })}>
          <option value="">Interest</option>
          {INTERESTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <input className={field} inputMode="decimal" placeholder="Est. value $" value={v.estimated_value ?? ""}
          onChange={(e) => setV({ ...v, estimated_value: e.target.value })} />
        <input className={field} type="date" value={v.next_action_date ?? ""}
          onChange={(e) => setV({ ...v, next_action_date: e.target.value })} />
        <input className={`${field} sm:col-span-2`} placeholder="Next action, e.g. call Thursday"
          value={v.next_action ?? ""} onChange={(e) => setV({ ...v, next_action: e.target.value })} />
      </div>
      {error ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{error}</p> : null}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !v.name.trim()}
          className="rounded-full bg-amber px-5 py-2 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]">
          {pending ? "Saving" : "Add lead"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="ww-link inline-flex items-center text-[13.5px] font-semibold text-forest max-md:min-h-[44px]">
          Cancel
        </button>
      </div>
    </div>
  );
}

// A customer row bridges to the coaching side: linked customers deep-link to
// their Program page, unlinked ones (converted before the bridge existed, or
// boys program families joining the roster after all) get a one-tap add.
function CustomerRow({ customer: c }: { customer: Customer }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addToRoster() {
    setError(null);
    start(async () => {
      const res = await addCustomerToRoster(c.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] text-forest-deep">{c.name}</p>
        <p className="truncate text-[12px] text-[color:var(--color-text-muted)]">
          {c.email || c.phone || "—"} · {c.lifecycle_stage}
        </p>
        {error ? (
          <p role="alert" className="mt-0.5 text-[12px] text-[color:var(--color-state-error)]">{error}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {c.lifetime_value_cents > 0 ? (
          <span className="text-[13px] text-bark">{formatMoney(c.lifetime_value_cents)}</span>
        ) : null}
        <TaskQuickAdd variant="icon" link={{ customer_id: c.id, label: c.name, category: "sales" }} />
        {c.client_id ? (
          <Link
            href={`/program/clients/${c.client_id}`}
            className="ww-link text-[12.5px] font-semibold text-forest max-md:min-h-[44px] max-md:inline-flex max-md:items-center"
          >
            On Program
          </Link>
        ) : (
          <button
            type="button"
            onClick={addToRoster}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-60 max-md:min-h-[44px]"
          >
            <UserPlus size={13} aria-hidden="true" /> Add to roster
          </button>
        )}
      </div>
    </li>
  );
}

// The card is the map view of a lead: name, interest, value, the next-step
// task, last touch, open tasks. Click it and the drawer becomes the workspace.
function LeadCard({
  lead,
  nextStep,
  openTaskCount,
  onOpen,
}: {
  lead: Lead;
  nextStep: Task | null;
  openTaskCount: number;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-[color:var(--border-hair)] bg-card p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-[color:var(--border-strong)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-forest-deep">{lead.name}</p>
            <p className="text-[12px] text-[color:var(--color-text-muted)]">
              {lead.interest ? lead.interest.replace(/_/g, " ") : "—"} · {lead.source.replace("_", " ")}
            </p>
          </div>
          {lead.estimated_value_cents != null ? (
            <span className="shrink-0 font-[family-name:var(--font-display)] text-[15px] text-bark">
              {formatMoney(lead.estimated_value_cents)}
            </span>
          ) : null}
        </div>

        {nextStep ? (
          <p className="mt-2 text-[13px] text-[color:var(--color-text)]">
            {nextStep.title}
            {nextStep.due_date ? (
              <span className="text-[color:var(--color-state-caution)]">
                {" "}· {new Date(nextStep.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--color-text-muted)]">
          {lead.customer_id ? <span className="font-semibold text-fern">Customer</span> : null}
          {openTaskCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ListChecks size={12} aria-hidden="true" />
              {openTaskCount} {openTaskCount === 1 ? "task" : "tasks"}
            </span>
          ) : null}
          {lead.last_activity_at ? (
            <span>
              Last touch{" "}
              {new Date(lead.last_activity_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

export function PipelineBoard({
  leads,
  customers,
  workspace,
}: {
  leads: Lead[];
  customers: Customer[];
  workspace: LeadWorkspace;
}) {
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  // Resolve from props each render so a refresh after any drawer action
  // shows the updated lead, timeline, and tasks.
  const openLead = openLeadId ? leads.find((l) => l.id === openLeadId) ?? null : null;

  const byStage = new Map<LeadStage, Lead[]>();
  for (const l of leads) {
    const arr = byStage.get(l.stage) ?? [];
    arr.push(l);
    byStage.set(l.stage, arr);
  }
  const activeStages = ORDER.filter((s) => s !== "lost" && (byStage.get(s)?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[color:var(--color-text-muted)]">
          {leads.length === 0 ? "No leads yet" : `${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
        </p>
        <AddLead />
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 text-[14px] leading-[1.55] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
          Add your first lead and it moves through the pipeline here, from new to
          won. Website inquiries will feed in automatically in a later pass.
        </div>
      ) : (
        activeStages.map((stage) => {
          const items = byStage.get(stage) ?? [];
          const label = STAGES.find((s) => s.value === stage)?.label ?? stage;
          const total = items.reduce((n, l) => n + (l.estimated_value_cents ?? 0), 0);
          return (
            <section key={stage}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
                  {label} <span className="text-[color:var(--color-text-faint)]">· {items.length}</span>
                </h2>
                {total > 0 ? (
                  <span className="text-[12.5px] text-[color:var(--color-text-muted)]">{formatMoney(total)}</span>
                ) : null}
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {items.map((l) => {
                  const leadTasks = workspace.tasksByLead[l.id] ?? [];
                  const nextStep =
                    leadTasks.find(
                      (t) => t.is_next_step && (t.status === "open" || t.status === "in_progress"),
                    ) ?? null;
                  return (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      nextStep={nextStep}
                      openTaskCount={leadTasks.filter((t) => t.status !== "done" && t.id !== nextStep?.id).length}
                      onOpen={() => setOpenLeadId(l.id)}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {customers.length > 0 ? (
        <section className="mt-2">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
            Customers <span className="text-[color:var(--color-text-faint)]">· {customers.length}</span>
          </h2>
          <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 shadow-[var(--shadow-card)]">
            {customers.map((c) => (
              <CustomerRow key={c.id} customer={c} />
            ))}
          </ul>
        </section>
      ) : null}

      {openLead ? (
        <LeadDrawer
          key={openLead.id}
          lead={openLead}
          activities={workspace.activitiesByLead[openLead.id] ?? []}
          tasks={workspace.tasksByLead[openLead.id] ?? []}
          onClose={() => setOpenLeadId(null)}
        />
      ) : null}
    </div>
  );
}
