"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { addLead, moveLeadStage, convertLeadToCustomer, type LeadInput } from "@/lib/business/actions";
import { formatMoney } from "@/lib/business/format";
import type { Lead, LeadStage, Customer } from "@/lib/data/business";

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

function LeadCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function move(stage: LeadStage) {
    start(async () => {
      await moveLeadStage(lead.id, stage);
      router.refresh();
    });
  }
  function convert() {
    start(async () => {
      await convertLeadToCustomer(lead.id);
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
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

      {lead.next_action ? (
        <p className="mt-2 text-[13px] text-[color:var(--color-text)]">
          {lead.next_action}
          {lead.next_action_date ? (
            <span className="text-[color:var(--color-state-caution)]">
              {" "}· {new Date(lead.next_action_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={lead.stage}
          disabled={pending}
          onChange={(e) => move(e.target.value as LeadStage)}
          className="h-11 rounded-lg border border-[color:var(--border-strong)] bg-canvas px-2 text-[16px] text-ink md:h-9 md:text-[13px]"
        >
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {!lead.customer_id && lead.stage !== "lost" ? (
          <button
            type="button"
            onClick={convert}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-60 max-md:min-h-[44px]"
          >
            <UserPlus size={13} aria-hidden="true" /> Convert
          </button>
        ) : lead.customer_id ? (
          <span className="text-[12px] font-semibold text-fern">Customer</span>
        ) : null}
      </div>
    </li>
  );
}

export function PipelineBoard({ leads, customers }: { leads: Lead[]; customers: Customer[] }) {
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
                {items.map((l) => <LeadCard key={l.id} lead={l} />)}
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
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] text-forest-deep">{c.name}</p>
                  <p className="truncate text-[12px] text-[color:var(--color-text-muted)]">
                    {c.email || c.phone || "—"} · {c.lifecycle_stage}
                  </p>
                </div>
                {c.lifetime_value_cents > 0 ? (
                  <span className="shrink-0 text-[13px] text-bark">{formatMoney(c.lifetime_value_cents)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
