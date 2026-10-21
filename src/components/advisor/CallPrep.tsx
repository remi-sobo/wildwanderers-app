"use client";

// Prep the call (specs/advisor-calls.md): an agenda drafted from real
// work since the last call, edited freely, and saved to that call so it
// is there next time. Private to the advisor.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveAgenda } from "@/lib/advisor/call-actions";

export function CallPrep({
  draft,
  saved,
  lastCall,
}: {
  draft: string;
  saved: string | null;
  lastCall: { id: string; title: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(saved ?? draft);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function save() {
    if (!lastCall) return;
    setNote(null);
    start(async () => {
      let res: { error: string | null };
      try {
        res = await saveAgenda(lastCall.id, text);
      } catch {
        res = { error: "Check your connection and try again." };
      }
      if (res.error) setNote({ tone: "error", text: `Not saved. ${res.error}` });
      else {
        setNote({ tone: "ok", text: `Saved to ${lastCall.title}.` });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/advisor/calls" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-forest md:min-h-0">
          ‹ Calls
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">Prep the next call</h1>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          Drafted from what you sent, what got done, and what you are waiting on. Edit it however you like.
        </p>
      </div>
      <textarea
        aria-label="Agenda"
        className="min-h-[320px] w-full rounded-2xl border border-[color:var(--border-strong)] bg-card p-4 text-[16px] leading-relaxed text-ink outline-none focus:border-amber md:text-[14.5px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        {lastCall ? (
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex min-h-[44px] items-center rounded-full bg-amber px-5 text-[14px] font-semibold text-[#23170c] disabled:opacity-60"
          >
            {pending ? "Saving" : "Save the agenda"}
          </button>
        ) : (
          <p className="text-[12.5px] text-[color:var(--color-text-muted)]">Add your first call to save an agenda with it.</p>
        )}
        <button
          type="button"
          onClick={() => setText(draft)}
          className="min-h-[44px] px-2 text-[13px] font-semibold text-forest"
        >
          Start again from the draft
        </button>
        {note ? (
          <p role={note.tone === "error" ? "alert" : "status"} className={`text-[13px] font-semibold ${note.tone === "error" ? "text-[color:var(--color-state-error)]" : "text-fern"}`}>
            {note.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
