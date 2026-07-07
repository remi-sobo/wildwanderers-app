"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Compass, Eye, EyeOff } from "lucide-react";
import { addAdventureEntry } from "@/lib/boys/actions";
import type { ProgramDetail as Detail, AdventureEntry, AdventureEntryKind } from "@/lib/data/boys";

const field = "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

const KIND_LABEL: Record<AdventureEntryKind, string> = {
  journal: "Nature journal",
  check_in: "Check-in",
  mentor_note: "Mentor note",
};

function fullName(p: { first_name: string; last_name: string }) {
  return `${p.first_name} ${p.last_name}`.trim();
}

export function AdventureTab({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState(detail.participants[0]?.id ?? "");
  const [kind, setKind] = useState<AdventureEntryKind>("journal");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const privateNote = kind === "mentor_note";

  function add() {
    if (!participantId || !body.trim()) return;
    setErr(null);
    start(async () => {
      const res = await addAdventureEntry(detail.program.id, participantId, { kind, title, body });
      if (res.error) setErr(res.error);
      else {
        setTitle("");
        setBody("");
        router.refresh();
      }
    });
  }

  if (detail.participants.length === 0) {
    return <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Add kids first, then log their adventures.</p>;
  }

  const byKid = new Map<string, AdventureEntry[]>();
  for (const e of detail.adventure) {
    const arr = byKid.get(e.participant_id) ?? [];
    arr.push(e);
    byKid.set(e.participant_id, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={field} value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
            {detail.participants.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </select>
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value as AdventureEntryKind)}>
            <option value="journal">Nature journal</option>
            <option value="check_in">Check-in</option>
            <option value="mentor_note">Mentor note (private)</option>
          </select>
          <input className={`${field} sm:col-span-2`} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="min-h-[80px] rounded-lg border border-[color:var(--border-strong)] bg-card px-3 py-2 text-[16px] text-ink sm:col-span-2 md:text-[14px]"
            placeholder={privateNote ? "A private note for staff" : "What happened on the trail today"}
            value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[color:var(--color-text-muted)]">
          {privateNote ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
          {privateNote ? "Private to staff. The family never sees this." : "The family sees this in their adventure view."}
        </p>
        {err ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{err}</p> : null}
        <button type="button" onClick={add} disabled={pending || !body.trim()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]">
          <Compass size={15} /> Add to the adventure
        </button>
      </div>

      {detail.adventure.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {detail.participants.filter((p) => (byKid.get(p.id)?.length ?? 0) > 0).map((p) => (
            <li key={p.id} className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-[14px] font-semibold text-forest-deep">{fullName(p)}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {(byKid.get(p.id) ?? []).map((e) => (
                  <li key={e.id} className="border-l-2 border-[color:var(--color-fern)] pl-3">
                    <p className="flex items-center gap-2 text-[12px] text-bark">
                      {KIND_LABEL[e.kind]} · {new Date(e.entry_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {!e.visible_to_family ? <span className="flex items-center gap-0.5 text-[color:var(--color-text-muted)]"><EyeOff size={11} /> private</span> : null}
                    </p>
                    {e.title ? <p className="text-[13.5px] font-medium text-forest-deep">{e.title}</p> : null}
                    <p className="text-[13.5px] leading-[1.5] text-[color:var(--color-text)]">{e.body}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
