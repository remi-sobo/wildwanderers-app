"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag, TrendingUp, Receipt, Plus, Check } from "lucide-react";
import {
  addRevenue,
  addExpense,
  setOfferingPrice,
  toggleOffering,
  type RevenueInput,
  type ExpenseInput,
} from "@/lib/business/actions";
import { formatMoney } from "@/lib/business/format";
import type { FinanceData, Offering } from "@/lib/data/business";

const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";
const REV_CATS = ["one_on_one", "small_group", "wellness", "boys_program", "other"];
const EXP_CATS = ["facilities", "equipment", "software", "marketing", "travel", "insurance", "food", "other"];
const label = (s: string) => s.replace(/_/g, " ");

function Section({
  icon: Icon,
  title,
  right,
  children,
}: {
  icon: typeof Tag;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
            <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">{title}</h2>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function OfferingRow({ offering }: { offering: Offering }) {
  const router = useRouter();
  const [price, setPrice] = useState(offering.price_cents != null ? String(offering.price_cents / 100) : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      await setOfferingPrice(offering.id, price);
      setSaved(true);
      router.refresh();
    });
  }
  function toggle() {
    start(async () => {
      await toggleOffering(offering.id, !offering.is_active);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-forest-deep">
          {offering.name}{" "}
          <span className="text-[12px] capitalize text-[color:var(--color-text-faint)]">· {offering.cadence.replace(/_/g, " ")}</span>
        </p>
        {offering.price_cents == null ? (
          <p className="text-[11.5px] text-[color:var(--color-state-caution)]">Set your price</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-[color:var(--color-text-muted)]">$</span>
        <input
          value={price}
          inputMode="decimal"
          onChange={(e) => { setPrice(e.target.value); setSaved(false); }}
          placeholder="0"
          className={`${field} w-24`}
        />
        <button type="button" onClick={save} disabled={pending}
          className="rounded-lg bg-inset px-3 py-2 text-[12.5px] font-semibold text-forest transition-colors hover:bg-sand disabled:opacity-60 max-md:min-h-[44px]">
          {saved ? <Check size={14} /> : "Save"}
        </button>
      </div>
      <button type="button" onClick={toggle} disabled={pending}
        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors max-md:min-h-[44px] ${
          offering.is_active
            ? "bg-[color:var(--color-state-good)]/12 text-[color:var(--color-state-good)]"
            : "bg-inset text-[color:var(--color-text-muted)]"
        }`}>
        {offering.is_active ? "Active" : "Off"}
      </button>
    </li>
  );
}

export function FinancePanel({ data }: { data: FinanceData }) {
  const router = useRouter();
  const [rev, setRev] = useState<RevenueInput>({ amount: "", category: "one_on_one" });
  const [exp, setExp] = useState<ExpenseInput>({ amount: "", category: "software" });
  const [revErr, setRevErr] = useState<string | null>(null);
  const [expErr, setExpErr] = useState<string | null>(null);
  const [savingRev, startRev] = useTransition();
  const [savingExp, startExp] = useTransition();

  function saveRev() {
    setRevErr(null);
    startRev(async () => {
      const res = await addRevenue(rev);
      if (res.error) setRevErr(res.error);
      else { setRev({ amount: "", category: rev.category }); router.refresh(); }
    });
  }
  function saveExp() {
    setExpErr(null);
    startExp(async () => {
      const res = await addExpense(exp);
      if (res.error) setExpErr(res.error);
      else { setExp({ amount: "", category: exp.category }); router.refresh(); }
    });
  }

  const net = data.revenueMtdCents - data.expensesMtdCents;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Revenue, month</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[26px] text-forest-deep">{formatMoney(data.revenueMtdCents)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Expenses, month</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[26px] text-forest-deep">{formatMoney(data.expensesMtdCents)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Net, month</p>
          <p className={`mt-2 font-[family-name:var(--font-display)] text-[26px] ${net >= 0 ? "text-forest-deep" : "text-[color:var(--color-state-error)]"}`}>
            {formatMoney(net)}
          </p>
        </div>
      </div>

      <Section icon={Tag} title="Offerings">
        <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
          {data.offerings.map((o) => <OfferingRow key={o.id} offering={o} />)}
        </ul>
      </Section>

      <Section icon={TrendingUp} title="Revenue">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={field} inputMode="decimal" placeholder="Amount $" value={rev.amount}
            onChange={(e) => setRev({ ...rev, amount: e.target.value })} />
          <select className={`${field} capitalize`} value={rev.category}
            onChange={(e) => setRev({ ...rev, category: e.target.value })}>
            {REV_CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
          <select className={field} value={rev.customer_id ?? ""}
            onChange={(e) => setRev({ ...rev, customer_id: e.target.value })}>
            <option value="">No customer</option>
            {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className={field} placeholder="Note" value={rev.description ?? ""}
            onChange={(e) => setRev({ ...rev, description: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={saveRev} disabled={savingRev || !rev.amount}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]">
            <Plus size={15} /> Log revenue
          </button>
          {revErr ? <span className="text-[13px] text-[color:var(--color-state-error)]">{revErr}</span> : null}
        </div>
        {data.revenue.length > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-[color:var(--border-hair)] border-t border-[color:var(--border-hair)]">
            {data.revenue.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="min-w-0 truncate text-[color:var(--color-text)]">
                  <span className="capitalize">{label(r.category)}</span>
                  {r.customer_name ? ` · ${r.customer_name}` : ""}{r.description ? ` · ${r.description}` : ""}
                </span>
                <span className="shrink-0 text-forest-deep">{formatMoney(r.amount_cents)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section icon={Receipt} title="Expenses">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={field} inputMode="decimal" placeholder="Amount $" value={exp.amount}
            onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
          <select className={`${field} capitalize`} value={exp.category}
            onChange={(e) => setExp({ ...exp, category: e.target.value })}>
            {EXP_CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
          <input className={field} placeholder="Vendor" value={exp.vendor ?? ""}
            onChange={(e) => setExp({ ...exp, vendor: e.target.value })} />
          <input className={field} placeholder="Note" value={exp.description ?? ""}
            onChange={(e) => setExp({ ...exp, description: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={saveExp} disabled={savingExp || !exp.amount}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]">
            <Plus size={15} /> Log expense
          </button>
          {expErr ? <span className="text-[13px] text-[color:var(--color-state-error)]">{expErr}</span> : null}
        </div>
        {data.expenses.length > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-[color:var(--border-hair)] border-t border-[color:var(--border-hair)]">
            {data.expenses.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="min-w-0 truncate text-[color:var(--color-text)]">
                  <span className="capitalize">{label(e.category)}</span>
                  {e.vendor ? ` · ${e.vendor}` : ""}{e.description ? ` · ${e.description}` : ""}
                </span>
                <span className="shrink-0 text-[color:var(--color-text-muted)]">{formatMoney(e.amount_cents)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}
