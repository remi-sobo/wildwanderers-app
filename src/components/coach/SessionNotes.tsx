"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Pencil } from "lucide-react";
import { saveSessionNote } from "@/lib/intake/actions";
import type { SessionRow } from "@/lib/data/sessions";

// Session notes over time: each past session with its one-line note, and an
// inline jot for the coach right after a session. The note lives on the
// session row, so the client reads it too; keep it something they can see.

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function NoteRow({
  session,
  clientId,
  canEdit,
}: {
  session: SessionRow;
  clientId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(session.notes ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await saveSessionNote(session.id, clientId, note);
      if (res.error) setErr(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.1em] text-bark">
          {fmtDay(session.start_at)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--color-text-muted)]">
          {session.title}
        </span>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-full p-1.5 text-bark transition hover:bg-inset max-md:min-h-[36px] max-md:min-w-[36px]"
            aria-label={`${session.notes ? "Edit" : "Add"} the note for ${fmtDay(session.start_at)}`}
          >
            {session.notes ? <Pencil size={13} aria-hidden="true" /> : <NotebookPen size={14} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="ww-input min-w-0 flex-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One line on how it went."
            maxLength={280}
            autoFocus
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-full bg-forest px-3.5 py-2 text-[12.5px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
          >
            {pending ? "Saving" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-3 py-2 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition hover:bg-inset max-md:min-h-[44px]"
          >
            Cancel
          </button>
          {err ? (
            <p role="alert" className="w-full text-[12.5px] text-[color:var(--color-state-error)]">
              {err}
            </p>
          ) : null}
        </div>
      ) : session.notes ? (
        <p className="text-[13.5px] leading-[1.5] text-ink">{session.notes}</p>
      ) : (
        <p className="text-[13px] text-[color:var(--color-text-faint)]">No note.</p>
      )}
    </li>
  );
}

export function SessionNotes({
  sessions,
  clientId,
  canEdit = true,
}: {
  sessions: SessionRow[];
  clientId: string;
  canEdit?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
        No past sessions yet. Notes gather here after each one.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
      {sessions.map((s) => (
        <NoteRow key={s.id} session={s} clientId={clientId} canEdit={canEdit} />
      ))}
    </ul>
  );
}
