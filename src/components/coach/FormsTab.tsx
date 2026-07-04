"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, Pencil, ShieldAlert } from "lucide-react";
import { updateForm, acknowledgeForm } from "@/lib/boys/actions";
import type { ProgramDetail as Detail, FormDef, Participant } from "@/lib/data/boys";

const field = "h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";

function fullName(p: { first_name: string; last_name: string }) {
  return `${p.first_name} ${p.last_name}`.trim();
}

// A form is signed for a kid when an acknowledgement exists for its CURRENT
// version. A version bump clears it until re-signed.
export function isSigned(detail: Detail, form: FormDef, participantId: string): boolean {
  return detail.acks.some(
    (a) => a.form_id === form.id && a.form_version === form.version && a.participant_id === participantId,
  );
}

function FormEditor({ detail, form }: { detail: Detail; form: FormDef }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(form.title);
  const [body, setBody] = useState(form.body ?? "");
  const [required, setRequired] = useState(form.is_required);
  const [active, setActive] = useState(form.is_active);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateForm(detail.program.id, form.id, { title, body, is_required: required, is_active: active });
      if (res.error) setErr(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  const placeholder = (form.body ?? "").startsWith("PLACEHOLDER");

  return (
    <li className="rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-forest-deep">
            {form.title}
            <span className="ml-2 text-[11px] text-[color:var(--color-text-muted)]">v{form.version}</span>
            {form.is_required ? <span className="ml-2 text-[11px] font-semibold text-bark">required</span> : null}
            {!form.is_active ? <span className="ml-2 text-[11px] text-[color:var(--color-text-muted)]">off</span> : null}
          </p>
          {placeholder ? (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[color:var(--color-state-caution)]">
              <ShieldAlert size={12} aria-hidden="true" /> Placeholder text. Replace it before any family signs.
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => setEditing((e) => !e)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12.5px] font-semibold text-forest transition hover:bg-inset">
          <Pencil size={13} /> Edit
        </button>
      </div>
      {editing ? (
        <div className="mt-3 border-t border-[color:var(--border-hair)] pt-3">
          <input className={`${field} w-full`} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="mt-2 min-h-[120px] w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 py-2 text-[14px] text-ink"
            value={body} onChange={(e) => setBody(e.target.value)} placeholder="The form text families read and sign" />
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] text-forest-deep">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
            </label>
            <label className="flex items-center gap-2 text-[13px] text-forest-deep">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
            </label>
          </div>
          <p className="mt-2 text-[12px] text-[color:var(--color-text-muted)]">
            Changing the text bumps the version and re-prompts every family to sign again.
          </p>
          {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={save} disabled={pending}
              className="rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60">
              {pending ? "Saving" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-forest">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function SignatureRecorder({ detail, requiredForms }: { detail: Detail; requiredForms: FormDef[] }) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState(detail.participants[0]?.id ?? "");
  const [formId, setFormId] = useState(requiredForms[0]?.id ?? "");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function record() {
    if (!participantId || !formId || !name.trim()) return;
    setErr(null);
    start(async () => {
      const res = await acknowledgeForm(detail.program.id, formId, participantId, name);
      if (res.error) setErr(res.error);
      else {
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[13px] font-semibold text-forest-deep">Record a signature</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select className={field} value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
          {detail.participants.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
        </select>
        <select className={field} value={formId} onChange={(e) => setFormId(e.target.value)}>
          {detail.forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <input className={field} placeholder="Signed by (name)" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" onClick={record} disabled={pending || !name.trim()}
          className="rounded-full bg-amber px-4 text-[13px] font-semibold text-[#23170c] transition hover:bg-amber-deep disabled:opacity-70">
          Record
        </button>
      </div>
      {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
    </div>
  );
}

export function FormsTab({ detail }: { detail: Detail }) {
  const requiredForms = detail.forms.filter((f) => f.is_active && f.is_required);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className="eyebrow text-bark">The forms</p>
        <ul className="mt-2 flex flex-col gap-2">
          {detail.forms.map((f) => <FormEditor key={f.id} detail={detail} form={f} />)}
        </ul>
      </section>

      {detail.participants.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="eyebrow text-bark">Who has signed</p>
          <SignatureRecorder detail={detail} requiredForms={requiredForms} />
          <ul className="flex flex-col gap-2">
            {detail.participants.map((p) => {
              const unsigned = requiredForms.filter((f) => !isSigned(detail, f, p.id));
              return (
                <li key={p.id} className="rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="shrink-0 text-forest" aria-hidden="true" />
                    <span className="flex-1 text-[14px] text-forest-deep">{fullName(p)}</span>
                    {unsigned.length === 0 ? (
                      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-fern">
                        <Check size={14} /> All signed
                      </span>
                    ) : (
                      <span className="text-[12.5px] font-semibold text-[color:var(--color-state-caution)]">
                        {unsigned.length} to sign
                      </span>
                    )}
                  </div>
                  {unsigned.length > 0 ? (
                    <p className="mt-1 pl-7 text-[12.5px] text-[color:var(--color-text-muted)]">
                      {unsigned.map((f) => f.title).join(", ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
