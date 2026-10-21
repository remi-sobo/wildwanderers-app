"use client";

// Calls (specs/advisor-calls.md): past calls, and Add a call. Paste a
// transcript or load a .txt file; saving goes straight to review. The
// transcript is private to the advisor and kept 90 days.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createCall } from "@/lib/advisor/call-actions";
import type { CallSummary } from "@/lib/data/advisor-calls";

const field =
  "w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] text-ink outline-none focus:border-amber md:text-[14px]";

function dayText(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const STATUS: Record<CallSummary["status"], string> = {
  new: "Not reviewed",
  extracted: "Ready to review",
  sent: "Sent",
};

export function CallsHome({ calls, orgId, ownerName }: { calls: CallSummary[]; orgId: string; ownerName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(calls.length === 0);
  const [draft, setDraft] = useState({ title: "", heldOn: new Date().toLocaleDateString("en-CA"), transcript: "" });
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  async function loadFile(file: File) {
    setError(null);
    if (file.size > 400_000) {
      setError("That file is too large. Paste the transcript instead, or split it.");
      return;
    }
    const text = await file.text();
    setDraft((d) => ({ ...d, transcript: text, title: d.title || file.name.replace(/\.[^.]+$/, "") }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      let res: { error: string | null; id?: string };
      try {
        res = await createCall({ orgId, ...draft, requestKey });
      } catch {
        res = { error: "Check your connection and try again. It will not be saved twice." };
      }
      if (res.error || !res.id) {
        setError(res.error ?? "That did not save. Try again.");
        return;
      }
      setRequestKey(crypto.randomUUID());
      router.push(`/advisor/calls/${res.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-bark">Advisor</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">Calls</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/advisor/calls/prep"
            className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--border-strong)] px-4 text-[13.5px] font-semibold text-forest-deep"
          >
            Prep the next call
          </Link>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex min-h-[44px] items-center rounded-full bg-amber px-4 text-[13.5px] font-semibold text-[#23170c]"
            >
              Add a call
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <form
          onSubmit={save}
          className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">Add a call</p>
          <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
            Only you see the transcript. It is kept 90 days, then deleted. {ownerName} sees only what you send.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={`${field} h-11 md:h-10 sm:flex-1`}
              placeholder="Title, like Weekly call"
              aria-label="Title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <input
              type="date"
              aria-label="Date of the call"
              className={`${field} h-11 sm:w-auto md:h-10`}
              value={draft.heldOn}
              onChange={(e) => setDraft({ ...draft, heldOn: e.target.value })}
            />
          </div>
          <textarea
            className={`${field} min-h-[180px] py-2 font-mono text-[13px] md:text-[13px]`}
            placeholder="Paste the transcript here"
            aria-label="Transcript"
            value={draft.transcript}
            onChange={(e) => setDraft({ ...draft, transcript: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-dashed border-[color:var(--border-strong)] px-4 text-[13px] font-semibold text-forest">
              Load a .txt file
              <input
                type="file"
                accept=".txt,.vtt,.srt,text/plain"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-[12px] text-[color:var(--color-text-muted)]">
              {draft.transcript ? `${draft.transcript.length.toLocaleString()} characters` : ""}
            </span>
            <button
              type="submit"
              disabled={pending || !draft.transcript.trim()}
              className="ml-auto inline-flex min-h-[44px] items-center rounded-full bg-amber px-5 text-[14px] font-semibold text-[#23170c] disabled:opacity-60"
            >
              {pending ? "Saving" : "Save and review"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-[13px] font-semibold text-[color:var(--color-state-error)]">
              Not saved. {error}
            </p>
          ) : null}
        </form>
      ) : null}

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        {calls.length > 0 ? (
          <ul>
            {calls.map((c, i) => (
              <li key={c.id} className={i > 0 ? "border-t border-[color:var(--border-hair)]" : undefined}>
                <Link href={`/advisor/calls/${c.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-forest-deep">{c.title}</span>
                    <span className="block text-[12.5px] text-[color:var(--color-text-muted)]">
                      {dayText(c.held_on)} · {STATUS[c.status]}
                    </span>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-[color:var(--color-text-faint)]" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-[13.5px] text-[color:var(--color-text-muted)]">
            No calls yet. Add one above after your next conversation.
          </p>
        )}
      </section>
    </div>
  );
}
