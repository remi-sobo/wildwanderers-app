"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, Users, Plus, Check } from "lucide-react";
import { updateOrgBranding, inviteCoach } from "@/lib/org/actions";
import type { Org, OrgCoach } from "@/lib/data/org";

const field = "h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";

function Card({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Palette;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
          <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">{title}</h2>
          {hint ? <p className="text-[12.5px] text-[color:var(--color-text-muted)]">{hint}</p> : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function OrgSettings({ org, coaches }: { org: Org; coaches: OrgCoach[] }) {
  const router = useRouter();
  const [brand, setBrand] = useState({
    name: org.name,
    logo_url: org.logo_url ?? "",
    primary_color: org.primary_color,
    secondary_color: org.secondary_color,
  });
  const [brandErr, setBrandErr] = useState<string | null>(null);
  const [brandSaved, setBrandSaved] = useState(false);
  const [savingBrand, startBrand] = useTransition();

  const [coach, setCoach] = useState({ first_name: "", last_name: "", email: "" });
  const [coachErr, setCoachErr] = useState<string | null>(null);
  const [coachSaved, setCoachSaved] = useState(false);
  const [savingCoach, startCoach] = useTransition();

  function saveBrand() {
    setBrandErr(null); setBrandSaved(false);
    startBrand(async () => {
      const res = await updateOrgBranding(brand);
      if (res.error) setBrandErr(res.error);
      else { setBrandSaved(true); router.refresh(); }
    });
  }
  function addCoach() {
    setCoachErr(null); setCoachSaved(false);
    startCoach(async () => {
      const res = await inviteCoach(coach);
      if (res.error) setCoachErr(res.error);
      else { setCoach({ first_name: "", last_name: "", email: "" }); setCoachSaved(true); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card icon={Palette} title="Brand" hint="The white-label fields, ready for the day a second coach comes aboard.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[12px] font-medium text-bark">Organization name</span>
            <input className={field} value={brand.name} onChange={(e) => { setBrandSaved(false); setBrand({ ...brand, name: e.target.value }); }} />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[12px] font-medium text-bark">Logo URL</span>
            <input className={field} placeholder="https://…" value={brand.logo_url}
              onChange={(e) => { setBrandSaved(false); setBrand({ ...brand, logo_url: e.target.value }); }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-bark">Primary color</span>
            <span className="flex items-center gap-2">
              <input type="color" value={brand.primary_color} onChange={(e) => { setBrandSaved(false); setBrand({ ...brand, primary_color: e.target.value }); }}
                className="h-10 w-12 rounded-lg border border-[color:var(--border-strong)] bg-card" />
              <input className={`${field} flex-1`} value={brand.primary_color}
                onChange={(e) => { setBrandSaved(false); setBrand({ ...brand, primary_color: e.target.value }); }} />
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-bark">Action color</span>
            <span className="flex items-center gap-2">
              <input type="color" value={brand.secondary_color} onChange={(e) => { setBrandSaved(false); setBrand({ ...brand, secondary_color: e.target.value }); }}
                className="h-10 w-12 rounded-lg border border-[color:var(--border-strong)] bg-card" />
              <input className={`${field} flex-1`} value={brand.secondary_color}
                onChange={(e) => { setBrandSaved(false); setBrand({ ...brand, secondary_color: e.target.value }); }} />
            </span>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveBrand} disabled={savingBrand || !brand.name.trim()}
            className="rounded-full bg-amber px-5 py-2 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70">
            {savingBrand ? "Saving" : "Save brand"}
          </button>
          {brandSaved ? <span className="flex items-center gap-1 text-[13px] text-fern"><Check size={15} /> Saved</span> : null}
          {brandErr ? <span className="text-[13px] text-[color:var(--color-state-error)]">{brandErr}</span> : null}
        </div>
      </Card>

      <Card icon={Users} title="Coaches" hint="Invite a second coach, the first step on the road to resale.">
        <ul className="mb-4 flex flex-col divide-y divide-[color:var(--border-hair)]">
          {coaches.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2.5 text-[14px]">
              <span className="text-forest-deep">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "Coach"}</span>
              <span className="rounded-full bg-inset px-2.5 py-0.5 text-[11px] font-semibold capitalize text-bark">{c.role}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={field} placeholder="First name" value={coach.first_name}
            onChange={(e) => setCoach({ ...coach, first_name: e.target.value })} />
          <input className={field} placeholder="Last name" value={coach.last_name}
            onChange={(e) => setCoach({ ...coach, last_name: e.target.value })} />
          <input className={field} placeholder="Email" value={coach.email}
            onChange={(e) => setCoach({ ...coach, email: e.target.value })} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={addCoach} disabled={savingCoach || !coach.first_name.trim() || !coach.email.trim()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-60">
            <Plus size={15} /> Invite coach
          </button>
          {coachSaved ? <span className="flex items-center gap-1 text-[13px] text-fern"><Check size={15} /> Invited</span> : null}
          {coachErr ? <span className="text-[13px] text-[color:var(--color-state-error)]">{coachErr}</span> : null}
        </div>
      </Card>
    </div>
  );
}
