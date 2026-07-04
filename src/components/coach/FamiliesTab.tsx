"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, ChevronDown, HeartPulse, Phone } from "lucide-react";
import {
  addGuardian,
  addKidToFamily,
  upsertMedical,
  addEmergencyContact,
  setPickup,
} from "@/lib/boys/actions";
import type {
  ProgramDetail as Detail,
  Participant,
  Guardian,
  MedicalRecord,
} from "@/lib/data/boys";

const field = "h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";
const area = "min-h-[64px] rounded-lg border border-[color:var(--border-strong)] bg-card px-3 py-2 text-[14px] text-ink";

function fullName(p: { first_name: string; last_name: string }) {
  return `${p.first_name} ${p.last_name}`.trim();
}

function KidDetails({ detail, kid }: { detail: Detail; kid: Participant }) {
  const router = useRouter();
  const med = detail.medical.find((m) => m.participant_id === kid.id) ?? null;
  const contacts = detail.emergency.filter((e) => e.participant_id === kid.id);
  const link = detail.guardianLinks.find((l) => l.participant_id === kid.id) ?? null;

  const [m, setM] = useState<MedicalRecord>({
    participant_id: kid.id,
    allergies: med?.allergies ?? "",
    conditions: med?.conditions ?? "",
    medications: med?.medications ?? "",
    notes: med?.notes ?? "",
    doctor_name: med?.doctor_name ?? "",
    doctor_phone: med?.doctor_phone ?? "",
    insurance_note: med?.insurance_note ?? "",
  } as MedicalRecord);
  const [ec, setEc] = useState({ name: "", relationship: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function saveMedical() {
    setErr(null);
    setSaved(false);
    start(async () => {
      const res = await upsertMedical(detail.program.id, kid.id, {
        allergies: m.allergies ?? undefined,
        conditions: m.conditions ?? undefined,
        medications: m.medications ?? undefined,
        notes: m.notes ?? undefined,
        doctor_name: m.doctor_name ?? undefined,
        doctor_phone: m.doctor_phone ?? undefined,
        insurance_note: m.insurance_note ?? undefined,
      });
      if (res.error) setErr(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }
  function addContact() {
    if (!ec.name.trim() || !ec.phone.trim()) return;
    start(async () => {
      const res = await addEmergencyContact(detail.program.id, kid.id, ec);
      if (res.error) setErr(res.error);
      else {
        setEc({ name: "", relationship: "", phone: "" });
        router.refresh();
      }
    });
  }
  function togglePickup() {
    if (!link) return;
    start(async () => {
      await setPickup(detail.program.id, link.id, !link.can_pickup);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-[color:var(--border-hair)] pt-3">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">
        <HeartPulse size={13} aria-hidden="true" /> Medical
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input className={field} placeholder="Allergies" value={m.allergies ?? ""} onChange={(e) => setM({ ...m, allergies: e.target.value })} />
        <input className={field} placeholder="Conditions" value={m.conditions ?? ""} onChange={(e) => setM({ ...m, conditions: e.target.value })} />
        <input className={field} placeholder="Medications" value={m.medications ?? ""} onChange={(e) => setM({ ...m, medications: e.target.value })} />
        <input className={field} placeholder="Doctor name" value={m.doctor_name ?? ""} onChange={(e) => setM({ ...m, doctor_name: e.target.value })} />
        <input className={field} placeholder="Doctor phone" value={m.doctor_phone ?? ""} onChange={(e) => setM({ ...m, doctor_phone: e.target.value })} />
        <input className={field} placeholder="Insurance note" value={m.insurance_note ?? ""} onChange={(e) => setM({ ...m, insurance_note: e.target.value })} />
        <textarea className={`${area} sm:col-span-2`} placeholder="Anything else Gabe should know" value={m.notes ?? ""} onChange={(e) => setM({ ...m, notes: e.target.value })} />
      </div>
      <button type="button" onClick={saveMedical} disabled={pending}
        className="mt-2 rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60">
        {pending ? "Saving" : "Save medical"}
      </button>
      {saved ? <span className="ml-2 text-[13px] text-fern">Saved.</span> : null}

      <p className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">
        <Phone size={13} aria-hidden="true" /> Emergency contacts
      </p>
      {contacts.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {contacts.map((c) => (
            <li key={c.id} className="text-[13px] text-forest-deep">
              {c.name}{c.relationship ? ` (${c.relationship})` : ""} · {c.phone}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input className={field} placeholder="Name" value={ec.name} onChange={(e) => setEc({ ...ec, name: e.target.value })} />
        <input className={field} placeholder="Relationship" value={ec.relationship} onChange={(e) => setEc({ ...ec, relationship: e.target.value })} />
        <input className={field} placeholder="Phone" value={ec.phone} onChange={(e) => setEc({ ...ec, phone: e.target.value })} />
        <button type="button" onClick={addContact} disabled={pending || !ec.name.trim() || !ec.phone.trim()}
          className="rounded-full border border-[color:var(--border-strong)] px-4 text-[13px] font-semibold text-forest transition hover:bg-inset disabled:opacity-60">
          Add
        </button>
      </div>

      {link ? (
        <label className="mt-3 flex items-center gap-2 text-[13px] text-forest-deep">
          <input type="checkbox" checked={link.can_pickup} onChange={togglePickup} disabled={pending} />
          This family may pick up
        </label>
      ) : null}
      {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
    </div>
  );
}

function FamilyCard({ detail, guardian }: { detail: Detail; guardian: Guardian }) {
  const router = useRouter();
  const kidIds = new Set(detail.guardianLinks.filter((l) => l.guardian_id === guardian.id).map((l) => l.participant_id));
  const kids = detail.participants.filter((p) => kidIds.has(p.id));
  const [openKid, setOpenKid] = useState<string | null>(null);
  const [showAddKid, setShowAddKid] = useState(false);
  const [kid, setKid] = useState({ first_name: "", last_name: guardian.last_name, grade: "", group_id: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function addKid() {
    setErr(null);
    start(async () => {
      const res = await addKidToFamily(detail.program.id, { ...kid, guardian_id: guardian.id });
      if (res.error) setErr(res.error);
      else {
        setKid({ first_name: "", last_name: guardian.last_name, grade: "", group_id: "" });
        setShowAddKid(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-forest-deep">
            {fullName(guardian)}
            {guardian.user_id ? <span className="ml-2 text-[11px] font-semibold text-fern">login active</span> : null}
          </p>
          {guardian.email || guardian.phone ? (
            <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
              {guardian.email}{guardian.email && guardian.phone ? " · " : ""}{guardian.phone}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => setShowAddKid((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12.5px] font-semibold text-forest transition hover:bg-inset">
          <Plus size={14} /> Add a kid
        </button>
      </div>

      {showAddKid ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={field} placeholder="First name" value={kid.first_name} onChange={(e) => setKid({ ...kid, first_name: e.target.value })} />
          <input className={field} placeholder="Last name" value={kid.last_name} onChange={(e) => setKid({ ...kid, last_name: e.target.value })} />
          <input className={field} inputMode="numeric" placeholder="Grade (1 to 12)" value={kid.grade} onChange={(e) => setKid({ ...kid, grade: e.target.value })} />
          <select className={field} value={kid.group_id} onChange={(e) => setKid({ ...kid, group_id: e.target.value })}>
            <option value="">No cohort</option>
            {detail.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="sm:col-span-2">
            <button type="button" onClick={addKid} disabled={pending || !kid.first_name.trim() || !kid.last_name.trim()}
              className="rounded-full bg-amber px-4 py-2 text-[13px] font-semibold text-[#23170c] transition hover:bg-amber-deep disabled:opacity-70">
              {pending ? "Adding" : "Add to the family"}
            </button>
            {err ? <span className="ml-2 text-[13px] text-[color:var(--color-state-error)]">{err}</span> : null}
          </div>
        </div>
      ) : null}

      {kids.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {kids.map((k) => (
            <li key={k.id} className="rounded-xl border border-[color:var(--border-hair)] bg-canvas px-4 py-3">
              <button type="button" onClick={() => setOpenKid(openKid === k.id ? null : k.id)}
                className="flex w-full items-center gap-2 text-left">
                <span className="flex-1 text-[14px] text-forest-deep">
                  {fullName(k)}{k.grade ? <span className="text-[12px] text-[color:var(--color-text-faint)]"> · grade {k.grade}</span> : null}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-forest transition-transform ${openKid === k.id ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {openKid === k.id ? <KidDetails detail={detail} kid={k} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-[color:var(--color-text-muted)]">No kids in this family yet.</p>
      )}
    </div>
  );
}

export function FamiliesTab({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [g, setG] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const linkedIds = new Set(detail.guardianLinks.map((l) => l.participant_id));
  const unlinked = detail.participants.filter((p) => !linkedIds.has(p.id));

  function addFamily() {
    setErr(null);
    start(async () => {
      const res = await addGuardian(detail.program.id, g);
      if (res.error) setErr(res.error);
      else {
        setG({ first_name: "", last_name: "", email: "", phone: "" });
        setShowAdd(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] text-[color:var(--color-text-muted)]">
          <Users size={14} className="text-forest" aria-hidden="true" />
          The family comes first, then the kids.
        </p>
        <button type="button" onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition hover:bg-amber-deep">
          <Plus size={15} /> Add a family
        </button>
      </div>

      {showAdd ? (
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={field} placeholder="Parent first name" value={g.first_name} onChange={(e) => setG({ ...g, first_name: e.target.value })} />
            <input className={field} placeholder="Parent last name" value={g.last_name} onChange={(e) => setG({ ...g, last_name: e.target.value })} />
            <input className={field} placeholder="Email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} />
            <input className={field} placeholder="Phone" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} />
          </div>
          {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
          <button type="button" onClick={addFamily} disabled={pending || !g.first_name.trim() || !g.last_name.trim()}
            className="mt-3 rounded-full bg-amber px-5 py-2 text-[14px] font-semibold text-[#23170c] transition hover:bg-amber-deep disabled:opacity-70">
            {pending ? "Adding" : "Add family"}
          </button>
        </div>
      ) : null}

      {detail.guardians.length === 0 && unlinked.length === 0 ? (
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
          No families yet. Add a family, then add their kids under it.
        </p>
      ) : null}

      {detail.guardians.map((guardian) => (
        <FamilyCard key={guardian.id} detail={detail} guardian={guardian} />
      ))}

      {unlinked.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
            Not linked to a family yet
          </p>
          <ul className="flex flex-col divide-y divide-[color:var(--border-hair)] rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 shadow-[var(--shadow-card)]">
            {unlinked.map((k) => (
              <li key={k.id} className="py-2.5 text-[14px] text-forest-deep">
                {fullName(k)}
                {k.parent_name ? <span className="text-[12px] text-[color:var(--color-text-muted)]"> · {k.parent_name}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
