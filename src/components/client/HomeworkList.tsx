"use client";

// The client's homework: open items first with title, details, and due
// date, checked off with one tap. Checking done opens the optional "how
// did it go" note, and a note can be added or changed after the fact.
// Done items sit below with their notes. Warm and roomy; this lives on
// a phone.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Circle } from "lucide-react";
import { setHomeworkDone, saveHomeworkNote } from "@/lib/homework/actions";
import type { Homework } from "@/lib/data/homework";

function shortDate(iso: string): string {
  return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function NoteEditor({
  item,
  pending,
  onSave,
}: {
  item: Homework;
  pending: boolean;
  onSave: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.completion_note ?? "");

  if (!editing) {
    return (
      <div className="mt-2">
        {item.completion_note ? (
          <p className="rounded-xl bg-inset px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-[color:var(--color-text)]">
            {item.completion_note}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1.5 min-h-[44px] text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
        >
          {item.completion_note ? "Edit your note" : "How did it go?"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <textarea
        rows={2}
        autoFocus
        className="w-full rounded-lg border border-[color:var(--border-strong)] bg-card p-3 text-[16px] leading-[1.5] text-ink outline-none focus:border-amber"
        placeholder="How did it go?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            onSave(note);
            setEditing(false);
          }}
          className="rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-70 min-h-[44px]"
        >
          Save note
        </button>
        <button
          type="button"
          onClick={() => {
            setNote(item.completion_note ?? "");
            setEditing(false);
          }}
          className="rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-ink min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function HomeworkList({ items }: { items: Homework[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The item just checked done, so its note field is right there.
  const [justDoneId, setJustDoneId] = useState<string | null>(null);

  const open = items.filter((h) => h.status === "assigned");
  const done = items.filter((h) => h.status === "done");

  function toggle(item: Homework) {
    setError(null);
    const marking = item.status !== "done";
    start(async () => {
      const res = await setHomeworkDone(item.id, marking);
      if (res.error) setError(res.error);
      else {
        setJustDoneId(marking ? item.id : null);
        router.refresh();
      }
    });
  }

  function saveNote(id: string, note: string) {
    setError(null);
    start(async () => {
      const res = await saveHomeworkNote(id, note);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function row(item: Homework) {
    const isDone = item.status === "done";
    return (
      <li
        key={item.id}
        className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 py-3.5 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => toggle(item)}
            disabled={pending}
            aria-label={isDone ? "Mark not done" : "Mark done"}
            className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center"
          >
            {isDone ? (
              <CircleCheck size={22} className="text-fern" aria-hidden="true" />
            ) : (
              <Circle size={22} className="text-[color:var(--color-text-faint)]" aria-hidden="true" />
            )}
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <p className={`text-[15px] leading-snug ${isDone ? "text-[color:var(--color-text-muted)]" : "text-forest-deep"}`}>
              {item.title}
            </p>
            {item.details_md ? (
              <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
                {item.details_md}
              </p>
            ) : null}
            <p className="mt-1 text-[12px] text-[color:var(--color-text-faint)]">
              {isDone && item.completed_at
                ? `Done ${shortDate(item.completed_at)}`
                : item.due_date
                  ? `Due ${shortDate(item.due_date)}`
                  : `From your coach, ${shortDate(item.assigned_at)}`}
            </p>
            {isDone ? (
              justDoneId === item.id && !item.completion_note ? (
                <NoteEditorAutoOpen item={item} pending={pending} onSave={(n) => saveNote(item.id, n)} />
              ) : (
                <NoteEditor item={item} pending={pending} onSave={(n) => saveNote(item.id, n)} />
              )
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="text-[13px] text-[color:var(--color-state-error)]">{error}</p>
      ) : null}

      {open.length > 0 ? (
        <ul className="flex flex-col gap-2.5">{open.map(row)}</ul>
      ) : done.length > 0 ? (
        <p className="text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
          All caught up. New homework from your coach lands here.
        </p>
      ) : null}

      {done.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-bark">
            Done
          </h2>
          <ul className="flex flex-col gap-2.5">{done.map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}

// Right after checking done, the note field is already open and waiting.
function NoteEditorAutoOpen({
  item,
  pending,
  onSave,
}: {
  item: Homework;
  pending: boolean;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return <NoteEditor item={item} pending={pending} onSave={onSave} />;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <textarea
        rows={2}
        className="w-full rounded-lg border border-[color:var(--border-strong)] bg-card p-3 text-[16px] leading-[1.5] text-ink outline-none focus:border-amber"
        placeholder="How did it go?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => onSave(note)}
          className="rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-70 min-h-[44px]"
        >
          Save note
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-ink min-h-[44px]"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
