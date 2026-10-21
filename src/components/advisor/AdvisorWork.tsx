"use client";

// The advisor's Work screen (specs/advisor.md): a box to add work, then
// three filters. Mine is the advisor's own to-dos and what they owe the
// owner. The owner's is what the advisor sent and what the owner shared,
// with its status. Waiting on is open questions and undecided
// suggestions. Nothing is sent until the advisor chooses where it goes.
// Each new item carries a request key made when writing starts, so a
// retry after a failed save never doubles it.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { addAdvisorWork, setAdvisorItemStatus, setDeliverableStage, type NewAdvisorWork } from "@/lib/advisor/actions";
import type { AdvisorItem, AdvisorTask, AdvisorWorkspace } from "@/lib/data/advisor";
import { groupWork, taskStatusLine } from "@/lib/advisor/work";

type Mode = NewAdvisorWork["mode"];
type Filter = "mine" | "owners" | "waiting";

const field =
  "w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] text-ink outline-none focus:border-amber md:text-[14px]";

function newKey() {
  return crypto.randomUUID();
}

function dateText(d: string | null): string | null {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AdvisorWork({ workspace }: { workspace: AdvisorWorkspace }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const owner = workspace.org?.owner_first_name || "The owner";
  const [filter, setFilter] = useState<Filter>("mine");
  const [mode, setMode] = useState<Mode>("private");
  const [draft, setDraft] = useState({ title: "", notes: "", dueDate: "" });
  const [requestKey, setRequestKey] = useState<string>(newKey);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeNote, setComposeNote] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const groups = useMemo(() => groupWork(workspace.items, workspace.tasks), [workspace]);

  const MODES: { key: Mode; label: string; help: string }[] = [
    { key: "private", label: "Me · private", help: "Only you see it." },
    { key: "owe", label: `I owe ${owner}`, help: `${owner} sees it once you mark it ready.` },
    { key: "assign", label: `Assign to ${owner}`, help: `Goes straight into ${owner}'s tasks. Use it for things you both agreed on.` },
    { key: "suggest", label: `Suggest to ${owner}`, help: `${owner} sees it and decides: add it, or not now.` },
    { key: "ask", label: `Ask ${owner}`, help: `A question you are waiting on. ${owner} sees it with your other shared work.` },
  ];

  if (!workspace.org) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] text-forest-deep">No workspace yet</h1>
        <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
          {workspace.loadFailed
            ? "We could not load your work. Check your connection and refresh."
            : "Your access is not active. Ask the owner who invited you to restore it in their Settings."}
        </p>
      </div>
    );
  }

  const orgId = workspace.org.org_id;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setComposeError(null);
    setComposeNote(null);
    const sent = mode;
    start(async () => {
      let res: { error: string | null };
      try {
        res = await addAdvisorWork({ orgId, mode: sent, ...draft, requestKey });
      } catch {
        res = { error: "Check your connection and try again. It will not be added twice." };
      }
      if (res.error) {
        // Keep the text and the same request key, so trying again is safe.
        setComposeError(res.error);
        return;
      }
      setDraft({ title: "", notes: "", dueDate: "" });
      setRequestKey(newKey());
      setComposeNote(
        sent === "private"
          ? "Added. Only you see it."
          : sent === "owe"
            ? `Added to what you owe ${owner}.`
            : sent === "assign"
              ? `Sent to ${owner}.`
              : sent === "suggest"
                ? `Suggested to ${owner}.`
                : `Asked ${owner}.`,
      );
      router.refresh();
    });
  }

  function act(id: string, fn: () => Promise<{ error: string | null }>) {
    setRowBusy(id);
    setRowErrors((r) => ({ ...r, [id]: "" }));
    start(async () => {
      let res: { error: string | null };
      try {
        res = await fn();
      } catch {
        res = { error: "Check your connection and try again." };
      }
      if (res.error) setRowErrors((r) => ({ ...r, [id]: res.error as string }));
      else router.refresh();
      setRowBusy(null);
    });
  }

  const rowError = (id: string) =>
    rowErrors[id] ? (
      <p role="alert" className="mt-1 text-[12.5px] font-semibold text-[color:var(--color-state-error)]">
        Not saved. {rowErrors[id]}
      </p>
    ) : null;

  function itemRow(i: AdvisorItem) {
    const done = i.status === "done";
    const due = dateText(i.due_date);
    return (
      <li key={i.id} className="border-t border-[color:var(--border-hair)] py-3 first:border-t-0">
        <div className="flex items-start gap-3">
          <button
            type="button"
            disabled={rowBusy === i.id}
            onClick={() => act(i.id, () => setAdvisorItemStatus(i.id, done ? "open" : "done"))}
            aria-label={done ? `Reopen "${i.title}"` : `Mark "${i.title}" done`}
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] ${
              done ? "border-fern bg-fern text-bone" : "border-[color:var(--border-strong)] bg-card text-transparent hover:text-fern"
            }`}
          >
            <Check size={17} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className={`text-[15px] font-semibold ${done ? "text-[color:var(--color-text-muted)] line-through" : "text-forest-deep"}`}>
              {i.title}
            </p>
            {i.notes ? <p className="mt-0.5 whitespace-pre-line text-[13px] text-[color:var(--color-text)]">{i.notes}</p> : null}
            <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
              {i.kind === "deliverable" ? `You owe ${owner}` : i.vis === "private" ? "Private" : `${owner} can see`}
              {due ? ` · Due ${due}` : ""}
            </p>
            {i.kind === "deliverable" && !done ? (
              <label className="mt-1.5 flex items-center gap-2 text-[12.5px] text-[color:var(--color-text-muted)]">
                Stage
                <select
                  value={i.stage ?? "drafting"}
                  disabled={rowBusy === i.id}
                  onChange={(e) => act(i.id, () => setDeliverableStage(i.id, e.target.value as "drafting" | "ready" | "shared"))}
                  className="h-9 rounded-lg border border-[color:var(--border-strong)] bg-card px-2 text-[13px] text-ink"
                >
                  <option value="drafting">Drafting</option>
                  <option value="ready">Ready for {owner}</option>
                  <option value="shared">Delivered</option>
                </select>
              </label>
            ) : null}
            {rowBusy === i.id ? <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">Saving</p> : null}
            {rowError(i.id)}
          </div>
          {!done ? (
            <button
              type="button"
              disabled={rowBusy === i.id}
              onClick={() => act(i.id, () => setAdvisorItemStatus(i.id, "dropped"))}
              className="min-h-[44px] shrink-0 px-2 text-[12.5px] font-semibold text-[color:var(--color-text-muted)] md:min-h-0"
            >
              Remove
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  function taskRow(t: AdvisorTask) {
    const due = dateText(t.due_date);
    const label = t.kind === "suggestion" ? "Suggestion" : t.from_me ? "Assigned" : "Shared with you";
    return (
      <li key={t.id} className="border-t border-[color:var(--border-hair)] py-3 first:border-t-0">
        <p className="text-[12px] font-semibold text-bark">{label}</p>
        <p
          className={`text-[15px] font-semibold ${
            t.masked ? "italic text-[color:var(--color-text-muted)]" : t.status === "done" ? "text-[color:var(--color-text-muted)] line-through" : "text-forest-deep"
          }`}
        >
          {t.title}
        </p>
        {t.description ? <p className="mt-0.5 whitespace-pre-line text-[13px] text-[color:var(--color-text)]">{t.description}</p> : null}
        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          {taskStatusLine(t, owner)}
          {due ? ` · Due ${due}` : ""}
        </p>
      </li>
    );
  }

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "mine", label: "Mine", count: groups.mine.filter((i) => i.status === "open").length },
    { key: "owners", label: `${owner}'s`, count: groups.owners.filter((t) => t.status === "open" || t.status === "in_progress").length },
    { key: "waiting", label: "Waiting on", count: groups.waiting.questions.length + groups.waiting.suggestions.length },
  ];

  const empty = (text: string) => <p className="py-3 text-[13.5px] text-[color:var(--color-text-muted)]">{text}</p>;
  const helpFor = MODES.find((m) => m.key === mode)?.help;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow text-bark">{workspace.org.org_name}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">Work</h1>
      </div>

      {workspace.loadFailed ? (
        <p role="alert" className="rounded-xl border border-[rgba(192,148,46,0.4)] bg-[rgba(192,148,46,0.12)] px-3 py-2 text-[13px] text-[#7A5A12]">
          Some of your work did not load. Refresh to try again.
        </p>
      ) : null}

      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]"
      >
        <div role="radiogroup" aria-label="Where it goes" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`min-h-[44px] rounded-full px-3.5 text-[13px] font-semibold md:min-h-[36px] ${
                mode === m.key ? "bg-forest text-bone" : "border border-[color:var(--border-strong)] text-forest-deep"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {helpFor ? <p className="text-[12.5px] text-[color:var(--color-text-muted)]">{helpFor}</p> : null}
        <input
          className={`${field} h-11 md:h-10`}
          placeholder="What is it?"
          aria-label="Title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className={`${field} min-h-[72px] py-2`}
          placeholder="Notes (optional)"
          aria-label="Notes"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
            Due
            <input
              type="date"
              className={`${field} h-11 w-auto md:h-10`}
              value={draft.dueDate}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
          </label>
          <button
            type="submit"
            disabled={pending || !draft.title.trim()}
            className="ml-auto inline-flex min-h-[44px] items-center rounded-full bg-amber px-5 text-[14px] font-semibold text-[#23170c] disabled:opacity-60"
          >
            {pending ? "Saving" : mode === "assign" ? "Assign" : mode === "suggest" ? "Suggest" : mode === "ask" ? "Ask" : "Add"}
          </button>
        </div>
        {composeError ? (
          <p role="alert" className="text-[13px] font-semibold text-[color:var(--color-state-error)]">
            Not saved. {composeError}
          </p>
        ) : null}
        {composeNote ? <p className="text-[13px] text-fern">{composeNote}</p> : null}
      </form>

      <div role="tablist" aria-label="Work" className="flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium md:min-h-[36px] ${
              filter === f.key ? "bg-forest text-bone" : "border border-[color:var(--border-strong)] bg-card text-[color:var(--color-text)]"
            }`}
          >
            {f.label}
            {f.count > 0 ? <span className={filter === f.key ? "text-bone/70" : "text-[color:var(--color-text-muted)]"}>{f.count}</span> : null}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-4 py-2 shadow-[var(--shadow-card)]">
        {filter === "mine" ? (
          groups.mine.length > 0 ? (
            <ul>{groups.mine.map(itemRow)}</ul>
          ) : (
            empty("Nothing here yet. Add a private to-do or something you owe above.")
          )
        ) : filter === "owners" ? (
          groups.owners.length > 0 ? (
            <ul>{groups.owners.map(taskRow)}</ul>
          ) : (
            empty(`Nothing in ${owner}'s tasks from you yet. Assign one from the box above.`)
          )
        ) : groups.waiting.questions.length + groups.waiting.suggestions.length > 0 ? (
          <ul>
            {groups.waiting.questions.map(itemRow)}
            {groups.waiting.suggestions.map(taskRow)}
          </ul>
        ) : (
          empty("Nothing you are waiting on.")
        )}
      </section>
    </div>
  );
}
