"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Pencil } from "lucide-react";
import { saveEnrollment, setEnrollmentStatus } from "@/lib/boys/actions";
import type { ProgramDetail as Detail, Participant, Enrollment, EnrollmentStatus } from "@/lib/data/boys";

const field = "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

const STATUSES: EnrollmentStatus[] = ["interested", "waitlisted", "offered", "enrolled", "withdrawn"];
const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  interested: "Interested",
  waitlisted: "Waitlisted",
  offered: "Offered",
  enrolled: "Enrolled",
  withdrawn: "Withdrawn",
};
const STATUS_STYLE: Record<EnrollmentStatus, string> = {
  interested: "bg-inset text-bark",
  waitlisted: "bg-[color:var(--color-state-caution)]/15 text-[color:var(--color-state-caution)]",
  offered: "bg-[color:var(--color-mist)] text-forest-deep",
  enrolled: "bg-[color:var(--color-state-good)]/15 text-[color:var(--color-state-good)]",
  withdrawn: "bg-inset text-[color:var(--color-text-muted)]",
};

function fullName(p: { first_name: string; last_name: string }) {
  return `${p.first_name} ${p.last_name}`.trim();
}
function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(0)}`;
}
function centsToDollars(cents: number | null | undefined): string {
  return cents == null ? "" : String(cents / 100);
}

function EnrollRow({ detail, kid }: { detail: Detail; kid: Participant }) {
  const router = useRouter();
  const enrollment: Enrollment | undefined = detail.enrollments.find((e) => e.participant_id === kid.id);
  const [showEdit, setShowEdit] = useState(false);
  const [offeringId, setOfferingId] = useState(enrollment?.offering_id ?? "");
  const [tuition, setTuition] = useState(centsToDollars(enrollment?.tuition_cents));
  const [scholarship, setScholarship] = useState(centsToDollars(enrollment?.scholarship_cents ?? 0));
  const [reason, setReason] = useState(enrollment?.scholarship_reason ?? "");
  const [notes, setNotes] = useState(enrollment?.notes ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const net = enrollment ? (enrollment.tuition_cents ?? 0) - (enrollment.scholarship_cents ?? 0) : null;

  function saveDetails() {
    setErr(null);
    start(async () => {
      const res = await saveEnrollment(detail.program.id, kid.id, {
        offeringId: offeringId || undefined,
        tuition: tuition || undefined,
        scholarship: scholarship || undefined,
        scholarshipReason: reason || undefined,
        notes: notes || undefined,
      });
      if (res.error) setErr(res.error);
      else {
        setShowEdit(false);
        router.refresh();
      }
    });
  }
  function move(status: EnrollmentStatus) {
    start(async () => {
      if (!enrollment) {
        // Start the record (interested), then the status buttons appear.
        const res = await saveEnrollment(detail.program.id, kid.id, {});
        if (res.error) { setErr(res.error); return; }
        router.refresh();
        return;
      }
      const res = await setEnrollmentStatus(detail.program.id, enrollment.id, status);
      if (res.error) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[14px] text-forest-deep">{fullName(kid)}</span>
        {enrollment ? (
          <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${STATUS_STYLE[enrollment.status]}`}>
            {STATUS_LABEL[enrollment.status]}
          </span>
        ) : null}
        {net != null ? (
          <span className="text-[12.5px] tabular-nums text-[color:var(--color-text-muted)]">
            {money(net)}{enrollment && enrollment.scholarship_cents > 0 ? " after aid" : ""}
          </span>
        ) : null}
        {enrollment ? (
          <button type="button" onClick={() => setShowEdit((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12px] font-semibold text-forest transition hover:bg-inset max-md:min-h-[44px]">
            <Pencil size={12} /> Tuition
          </button>
        ) : (
          <button type="button" onClick={() => move("interested")} disabled={pending}
            className="rounded-full bg-amber px-3.5 py-1.5 text-[12.5px] font-semibold text-[#23170c] transition hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]">
            Request a spot
          </button>
        )}
      </div>

      {enrollment ? (
        <div className="mt-2 flex flex-wrap gap-1.5 md:gap-1">
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => move(s)} disabled={pending || s === enrollment.status}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition max-md:min-h-[44px] max-md:px-3 ${
                s === enrollment.status ? STATUS_STYLE[s] : "bg-inset text-[color:var(--color-text-muted)] hover:bg-sand"
              }`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      ) : null}

      {showEdit ? (
        <div className="mt-3 border-t border-[color:var(--border-hair)] pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {detail.offerings.length > 0 ? (
              <select className={field} value={offeringId}
                onChange={(e) => {
                  setOfferingId(e.target.value);
                  const off = detail.offerings.find((o) => o.id === e.target.value);
                  if (off?.price_cents != null) setTuition(String(off.price_cents / 100));
                }}>
                <option value="">No offering</option>
                {detail.offerings.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.price_cents != null ? ` (${money(o.price_cents)})` : ""}</option>
                ))}
              </select>
            ) : null}
            <input className={field} inputMode="decimal" placeholder="Tuition ($)" value={tuition} onChange={(e) => setTuition(e.target.value)} />
            <input className={field} inputMode="decimal" placeholder="Scholarship ($)" value={scholarship} onChange={(e) => setScholarship(e.target.value)} />
            <input className={field} placeholder="Scholarship reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <input className={`${field} sm:col-span-2`} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={saveDetails} disabled={pending}
              className="rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]">
              {pending ? "Saving" : "Save"}
            </button>
            <button type="button" onClick={() => setShowEdit(false)}
              className="rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-forest max-md:min-h-[44px]">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function EnrollmentTab({ detail }: { detail: Detail }) {
  if (detail.participants.length === 0) {
    return <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Add families and kids first, then take enrollments.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-1.5 text-[13px] text-[color:var(--color-text-muted)]">
        <GraduationCap size={14} className="text-forest" aria-hidden="true" />
        A family requests a spot, joins the waitlist, is offered one, and enrolls. Tuition comes from an offering; a scholarship is a recorded discount.
      </p>
      <ul className="flex flex-col gap-2">
        {detail.participants.map((k) => <EnrollRow key={k.id} detail={detail} kid={k} />)}
      </ul>
    </div>
  );
}
