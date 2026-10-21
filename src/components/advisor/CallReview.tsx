"use client";

// One call (specs/advisor-calls.md): propose items from the transcript,
// review them in four groups with their source quotes and flags, then
// send. Nothing reaches the owner until Send, the preview shows exactly
// what they will see, and an item whose owner is unclear is held back.
// After sending, this is the call record.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addCallItem,
  deleteCall,
  extractCall,
  sendCall,
  updateCallItem,
  type CallItemPatch,
} from "@/lib/advisor/call-actions";
import { sendPreview, type CallItem, type CallOwner, type CallSection } from "@/lib/advisor/calls";
import type { CallDetail } from "@/lib/data/advisor-calls";

const field =
  "w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] text-ink outline-none focus:border-amber md:text-[14px]";

function dayText(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CallReview({
  call,
  ownerName,
  taskTitles,
}: {
  call: CallDetail;
  ownerName: string;
  /** Titles of tasks the advisor can see, for "already in the app" links. */
  taskTitles: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState({ section: "owner" as CallSection, text: "", owner: "owner" as CallOwner });

  const GROUPS: { key: CallSection; label: string; empty: string }[] = [
    { key: "owner", label: `For ${ownerName}`, empty: `Nothing for ${ownerName} from this call yet.` },
    { key: "advisor", label: "For me", empty: "Nothing for you from this call yet." },
    { key: "decided", label: "What we decided", empty: "No decisions noted." },
    { key: "note", label: "Other notes", empty: "No other notes." },
  ];
  const FLAG_TEXT: Record<string, string> = {
    already_in_app: "Already in the app",
    possibly_done: "Possibly done",
    needs_clarification: "Needs clarification",
    idea: "Idea",
    goal: "Goal",
  };
  const OWNER_TEXT: Record<CallOwner, string> = { owner: ownerName, advisor: "Me", unclear: "Not sure" };

  const visible = call.items.filter((i) => i.state !== "removed");
  const removed = call.items.filter((i) => i.state === "removed");
  const preview = useMemo(() => sendPreview(call.items), [call.items]);
  const pendingSend =
    preview.toOwner.length + preview.toMe.length + preview.onRecord.length + preview.linked.length > 0;

  function run(key: string, fn: () => Promise<{ error: string | null }>, after?: (r: unknown) => void) {
    setBusy(key);
    setErrors((e) => ({ ...e, [key]: "" }));
    start(async () => {
      let res: { error: string | null };
      try {
        res = await fn();
      } catch {
        res = { error: "Check your connection and try again." };
      }
      if (res.error) setErrors((e) => ({ ...e, [key]: res.error as string }));
      else {
        after?.(res);
        router.refresh();
      }
      setBusy(null);
    });
  }

  const patch = (i: CallItem, p: CallItemPatch) => run(i.id, () => updateCallItem(i.id, call.id, p));

  function itemCard(i: CallItem) {
    const sent = i.state === "sent";
    const accepted = i.state === "accepted";
    const draft = drafts[i.id] ?? i.text;
    const matchTitle = i.match_task_id ? taskTitles[i.match_task_id] : null;
    const sentNote = !sent
      ? null
      : i.match_task_id
        ? "Linked to the task already in the app"
        : i.section === "owner" && i.owner === "owner" && !i.keep_private
          ? `Sent to ${ownerName}${i.send_as === "suggestion" ? " as a suggestion" : ""}`
          : i.section === "owner" || i.section === "advisor"
            ? "Saved to your to-dos, private"
            : "Saved to the call, not tasks";

    return (
      <li
        key={i.id}
        className={`rounded-[14px] border px-3.5 py-3 ${
          accepted ? "border-forest/40 bg-card" : sent ? "border-[color:var(--border-hair)] bg-inset/40" : "border-[color:var(--border-hair)] bg-card"
        }`}
      >
        {i.flag ? (
          <p
            className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
              i.flag === "needs_clarification" || i.flag === "possibly_done"
                ? "bg-[rgba(192,148,46,0.14)] text-[#8A6A1F]"
                : "bg-inset text-bark"
            }`}
          >
            {FLAG_TEXT[i.flag]}
            {matchTitle ? `: ${matchTitle}` : ""}
          </p>
        ) : null}

        {sent ? (
          <p className="text-[15px] font-semibold text-forest-deep">{i.text}</p>
        ) : (
          <textarea
            aria-label="Item"
            className={`${field} min-h-[44px] resize-y py-2 font-semibold text-forest-deep`}
            rows={1}
            value={draft}
            onChange={(e) => setDrafts((d) => ({ ...d, [i.id]: e.target.value }))}
            onBlur={() => {
              if (draft.trim() && draft.trim() !== i.text) patch(i, { text: draft });
            }}
          />
        )}

        {i.quote ? (
          <blockquote className="mt-1.5 border-l-2 border-mist pl-2.5 text-[12.5px] italic text-[color:var(--color-text-muted)]">
            {i.quote_at ? <span className="not-italic font-semibold">{i.quote_at} </span> : null}
            &ldquo;{i.quote}&rdquo;
          </blockquote>
        ) : null}

        {sent ? (
          <p className="mt-1.5 text-[12.5px] font-semibold text-fern">{sentNote}</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {i.section === "owner" || i.section === "advisor" ? (
              <label className="flex items-center gap-1.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                Whose
                <select
                  value={i.owner}
                  disabled={busy === i.id}
                  onChange={(e) => patch(i, { owner: e.target.value as CallOwner })}
                  className="h-9 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[13px] text-ink"
                >
                  {(["owner", "advisor", "unclear"] as CallOwner[]).map((o) => (
                    <option key={o} value={o}>
                      {OWNER_TEXT[o]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {i.match_task_id ? (
              <span className="flex items-center gap-2 text-[12.5px] text-[color:var(--color-text-muted)]">
                Links to the existing task, nothing new is sent.
                <button
                  type="button"
                  disabled={busy === i.id}
                  onClick={() => patch(i, { unlink: true })}
                  className="min-h-[36px] font-semibold text-forest max-md:min-h-[44px]"
                >
                  Not the same
                </button>
              </span>
            ) : null}
            {i.section === "owner" && i.owner === "owner" && !i.keep_private && !i.match_task_id ? (
              <div role="radiogroup" aria-label="Send as" className="flex gap-1">
                {(["assignment", "suggestion"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={i.send_as === k}
                    disabled={busy === i.id}
                    onClick={() => patch(i, { send_as: k })}
                    className={`min-h-[36px] rounded-full px-3 text-[12.5px] font-semibold max-md:min-h-[44px] ${
                      i.send_as === k ? "bg-forest text-bone" : "border border-[color:var(--border-strong)] text-forest-deep"
                    }`}
                  >
                    {k === "assignment" ? "Assign" : "Suggest"}
                  </button>
                ))}
              </div>
            ) : null}
            {i.section === "owner" || i.section === "advisor" ? (
              <input
                type="date"
                aria-label="Due"
                value={i.due_date ?? ""}
                disabled={busy === i.id}
                onChange={(e) => patch(i, { due_date: e.target.value || null })}
                className="h-9 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[13px] text-ink max-md:h-11"
              />
            ) : null}
            {i.section === "owner" ? (
              <label className="flex min-h-[36px] items-center gap-1.5 text-[12.5px] text-[color:var(--color-text-muted)] max-md:min-h-[44px]">
                <input
                  type="checkbox"
                  checked={i.keep_private}
                  disabled={busy === i.id}
                  onChange={(e) => patch(i, { keep_private: e.target.checked })}
                  className="h-4 w-4 accent-[#2e4a33]"
                />
                Keep private
              </label>
            ) : null}
            <div className="ml-auto flex gap-1.5">
              <button
                type="button"
                disabled={busy === i.id}
                onClick={() => patch(i, { state: accepted ? "proposed" : "accepted" })}
                aria-pressed={accepted}
                className={`min-h-[36px] rounded-full px-3.5 text-[12.5px] font-semibold max-md:min-h-[44px] ${
                  accepted ? "bg-fern text-bone" : "border border-[color:var(--border-strong)] text-forest-deep"
                }`}
              >
                {accepted ? "Accepted" : "Accept"}
              </button>
              <button
                type="button"
                disabled={busy === i.id}
                onClick={() => patch(i, { state: "removed" })}
                className="min-h-[36px] px-2 text-[12.5px] font-semibold text-[color:var(--color-text-muted)] max-md:min-h-[44px]"
              >
                Remove
              </button>
            </div>
          </div>
        )}
        {busy === i.id ? <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">Saving</p> : null}
        {errors[i.id] ? (
          <p role="alert" className="mt-1 text-[12.5px] font-semibold text-[color:var(--color-state-error)]">
            Not saved. {errors[i.id]}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/advisor/calls" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-forest md:min-h-0">
          ‹ Calls
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">{call.title}</h1>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          {dayText(call.held_on)} · Private to you · Deleted {dayText(call.expires_at)}
        </p>
      </div>

      {banner ? (
        <p
          role={banner.tone === "error" ? "alert" : "status"}
          className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
            banner.tone === "error"
              ? "border border-[color:var(--color-state-error)]/40 text-[color:var(--color-state-error)]"
              : "border border-fern/40 text-fern"
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      {call.items.length === 0 ? (
        <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-[14px] text-forest-deep">Read the transcript and propose items, each with the words it came from.</p>
          <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)]">Nothing sends until you review and choose to.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run("extract", () => extractCall(call.id), (r) => {
                const added = (r as { added?: number }).added ?? 0;
                setBanner({ tone: "ok", text: added > 0 ? `${added} items proposed. Review them below.` : "Nothing to propose from this call." });
              })
            }
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-amber px-5 text-[14px] font-semibold text-[#23170c] disabled:opacity-60"
          >
            {busy === "extract" ? "Reading the transcript" : "Propose items"}
          </button>
          {errors.extract ? (
            <p role="alert" className="mt-2 text-[13px] font-semibold text-[color:var(--color-state-error)]">
              {errors.extract}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => {
          const items = visible.filter((i) => i.section === g.key);
          return (
            <section key={g.key} aria-label={g.label}>
              <h2 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">{g.label}</h2>
              {items.length > 0 ? (
                <ul className="flex flex-col gap-2">{items.map(itemCard)}</ul>
              ) : (
                <p className="rounded-[14px] border border-[color:var(--border-hair)] bg-card px-3.5 py-3 text-[13px] text-[color:var(--color-text-muted)]">
                  {g.empty}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run("add", () => addCallItem({ sessionId: call.id, ...adding }), () => setAdding({ ...adding, text: "" }));
        }}
        className="flex flex-col gap-2 rounded-2xl border border-dashed border-[color:var(--border-strong)] p-3 sm:flex-row sm:items-center"
      >
        <select
          aria-label="Group"
          value={adding.section}
          onChange={(e) => {
            const section = e.target.value as CallSection;
            setAdding({ ...adding, section, owner: section === "advisor" ? "advisor" : "owner" });
          }}
          className="h-11 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[13px] text-ink md:h-10"
        >
          {GROUPS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
        <input
          className={`${field} h-11 md:h-10 sm:flex-1`}
          placeholder="Add an item by hand"
          aria-label="New item"
          value={adding.text}
          onChange={(e) => setAdding({ ...adding, text: e.target.value })}
        />
        <button
          type="submit"
          disabled={pending || !adding.text.trim()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[color:var(--border-strong)] px-4 text-[13.5px] font-semibold text-forest-deep disabled:opacity-60 md:min-h-[40px]"
        >
          Add
        </button>
        {errors.add ? <p role="alert" className="text-[12.5px] text-[color:var(--color-state-error)]">{errors.add}</p> : null}
      </form>

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">What {ownerName} will see</h2>
        <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)]">
          Only accepted items go. {ownerName} sees the item and its date, never the transcript or the quote.
        </p>
        {preview.toOwner.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {preview.toOwner.map((i) => (
              <li key={i.id} className="text-[14px] text-forest-deep">
                <span className="text-[12px] font-semibold text-bark">{i.send_as === "suggestion" ? "Suggestion" : "Assigned"} · </span>
                {i.text}
                {i.due_date ? <span className="text-[12.5px] text-[color:var(--color-text-muted)]"> · Due {dayText(i.due_date)}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13.5px] text-[color:var(--color-text-muted)]">Nothing for {ownerName} yet.</p>
        )}
        <p className="mt-2 text-[12.5px] text-[color:var(--color-text-muted)]">
          {preview.toMe.length > 0 ? `${preview.toMe.length} saved to your private to-dos. ` : ""}
          {preview.onRecord.length > 0 ? `${preview.onRecord.length} kept on the call record. ` : ""}
          {preview.linked.length > 0 ? `${preview.linked.length} linked to work already in the app. ` : ""}
        </p>
        {preview.held.length > 0 ? (
          <p className="mt-1 text-[12.5px] font-semibold text-[#8A6A1F]">
            {preview.held.length} held back until you choose whose it is, or how to send it.
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending || !pendingSend}
          onClick={() =>
            run("send", () => sendCall(call.id), (r) => {
              const c = (r as { counts?: { sent_tasks: number; saved_todos: number; held_back: number } }).counts;
              setBanner({
                tone: "ok",
                text: c
                  ? `Sent ${c.sent_tasks} to ${ownerName}, saved ${c.saved_todos} for you.${c.held_back ? ` ${c.held_back} still held back.` : ""}`
                  : "Sent.",
              });
            })
          }
          className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-amber px-5 text-[14px] font-semibold text-[#23170c] disabled:opacity-60"
        >
          {busy === "send" ? "Sending" : `Send to ${ownerName}`}
        </button>
        {errors.send ? (
          <p role="alert" className="mt-2 text-[13px] font-semibold text-[color:var(--color-state-error)]">
            Not sent. {errors.send} Nothing went twice.
          </p>
        ) : null}
      </section>

      {removed.length > 0 ? (
        <details className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-[color:var(--color-text-muted)]">
            Removed ({removed.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {removed.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-[13.5px] text-[color:var(--color-text-muted)]">
                <span className="line-through">{i.text}</span>
                <button
                  type="button"
                  onClick={() => patch(i, { state: "proposed" })}
                  className="min-h-[44px] px-2 text-[12.5px] font-semibold text-forest md:min-h-0"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <details className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-forest-deep">Transcript</summary>
        <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-[12.5px] text-[color:var(--color-text)]">
          {call.transcript}
        </pre>
      </details>

      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Delete this call and its transcript? Tasks already sent stay.")) return;
            run("delete", () => deleteCall(call.id), () => router.push("/advisor/calls"));
          }}
          className="min-h-[44px] text-[13px] font-semibold text-[color:var(--color-state-error)]"
        >
          Delete this call
        </button>
        {errors.delete ? <p role="alert" className="text-[12.5px] text-[color:var(--color-state-error)]">{errors.delete}</p> : null}
      </div>
    </div>
  );
}
