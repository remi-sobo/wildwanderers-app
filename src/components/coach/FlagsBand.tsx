"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Plus, RotateCcw, Pencil, Check, History } from "lucide-react";
import { addFlag, updateFlag, setFlagStatus } from "@/lib/intake/actions";
import type { FlagRow } from "@/lib/data/intake";

// The standing flags band. Amber, never red: a person's body is never an
// error state. One line each, always visible wherever the coach opens the
// client, so the knee from the first conversation is in view at session
// thirty. Flags are training accommodations, never diagnoses; the composer
// says so in helper text.

const HELPER =
  "A flag is a training accommodation: what to know, and what we adjust. Plain words, never a diagnosis.";

export function FlagComposer({
  clientId,
  initialKnow = "",
  createdFrom = "manual",
  onDone,
}: {
  clientId: string;
  initialKnow?: string;
  createdFrom?: "intake" | "manual";
  onDone?: () => void;
}) {
  const router = useRouter();
  const [know, setKnow] = useState(initialKnow);
  const [adjust, setAdjust] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await addFlag(clientId, {
        knowText: know,
        adjustText: adjust,
        createdFrom,
      });
      if (res.error) setErr(res.error);
      else {
        setKnow("");
        setAdjust("");
        router.refresh();
        onDone?.();
      }
    });
  }

  return (
    <div className="rounded-xl border border-[color:var(--border-strong)] bg-card p-3.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-bark">What to know</span>
          <input
            className="ww-input"
            value={know}
            onChange={(e) => setKnow(e.target.value)}
            placeholder="Left knee surgery 2019"
            maxLength={140}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-bark">What we adjust</span>
          <input
            className="ww-input"
            value={adjust}
            onChange={(e) => setAdjust(e.target.value)}
            placeholder="No loaded jumping"
            maxLength={140}
          />
        </label>
      </div>
      <p className="mt-2 text-[12px] leading-[1.5] text-[color:var(--color-text-muted)]">
        {HELPER}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !know.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
        >
          <Check size={14} aria-hidden="true" />
          {pending ? "Saving" : "Add flag"}
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="rounded-full px-3 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] transition hover:bg-inset max-md:min-h-[44px]"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {err ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function FlagLine({
  flag,
  clientId,
  canManage,
}: {
  flag: FlagRow;
  clientId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [know, setKnow] = useState(flag.know_text);
  const [adjust, setAdjust] = useState(flag.adjust_text ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function saveEdit() {
    setErr(null);
    start(async () => {
      const res = await updateFlag(flag.id, clientId, { knowText: know, adjustText: adjust });
      if (res.error) setErr(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function resolve() {
    start(async () => {
      const res = await setFlagStatus(flag.id, clientId, "resolved");
      if (!res.error) router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-[color:var(--border-strong)] bg-card p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="ww-input"
            value={know}
            onChange={(e) => setKnow(e.target.value)}
            maxLength={140}
            aria-label="What to know"
          />
          <input
            className="ww-input"
            value={adjust}
            onChange={(e) => setAdjust(e.target.value)}
            maxLength={140}
            aria-label="What we adjust"
            placeholder="What we adjust"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={saveEdit}
            disabled={pending || !know.trim()}
            className="rounded-full bg-forest px-3.5 py-1.5 text-[12.5px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
          >
            {pending ? "Saving" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition hover:bg-inset max-md:min-h-[44px]"
          >
            Cancel
          </button>
        </div>
        {err ? (
          <p role="alert" className="mt-1.5 text-[12.5px] text-[color:var(--color-state-error)]">
            {err}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-2.5">
      <Flag size={14} className="mt-[3px] shrink-0 text-amber-deep" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-ink">
        <span className="font-semibold">{flag.know_text}</span>
        {flag.adjust_text ? (
          <span className="text-[color:var(--color-text-muted)]">
            {" "}
            · we adjust: {flag.adjust_text}
          </span>
        ) : null}
      </p>
      {canManage ? (
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full p-1.5 text-bark transition hover:bg-amber/20 max-md:min-h-[36px] max-md:min-w-[36px]"
            aria-label={`Edit flag: ${flag.know_text}`}
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resolve}
            disabled={pending}
            className="rounded-full p-1.5 text-bark transition hover:bg-amber/20 max-md:min-h-[36px] max-md:min-w-[36px]"
            aria-label={`Resolve flag: ${flag.know_text}`}
            title="Resolve, keep in history"
          >
            <Check size={13} aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </li>
  );
}

export function FlagsBand({
  clientId,
  flags,
  variant = "full",
  audience = "coach",
}: {
  clientId: string;
  flags: FlagRow[];
  /** full = profile band with add, resolve, history. compact = read-only glance. */
  variant?: "full" | "compact";
  /** The client reads their own flags; framing warms up, controls go away. */
  audience?: "coach" | "client";
}) {
  const [adding, setAdding] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const router = useRouter();
  const [, start] = useTransition();

  const active = flags.filter((f) => f.status === "active");
  const resolved = flags.filter((f) => f.status === "resolved");
  const canManage = audience === "coach" && variant === "full";

  if (variant === "compact" && active.length === 0) return null;

  function reopen(id: string) {
    start(async () => {
      const res = await setFlagStatus(id, clientId, "active");
      if (!res.error) router.refresh();
    });
  }

  return (
    <section
      className="rounded-2xl border border-amber/50 bg-amber/10 px-5 py-4"
      aria-label={audience === "client" ? "What training works around" : "Standing flags"}
    >
      <div className="flex items-center gap-2.5">
        <Flag size={15} className="shrink-0 text-amber-deep" aria-hidden="true" />
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-deep">
          {audience === "client" ? "What we work around" : "Standing flags"}
        </p>
        {canManage ? (
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-1 rounded-full border border-amber/60 px-2.5 py-1 text-[12px] font-semibold text-amber-deep transition hover:bg-amber/20 max-md:min-h-[36px]"
          >
            <Plus size={13} aria-hidden="true" />
            Add
          </button>
        ) : null}
      </div>

      {active.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {active.map((f) => (
            <FlagLine key={f.id} flag={f} clientId={clientId} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
          {audience === "client"
            ? "Nothing standing right now."
            : "No standing flags. Add anything worth knowing every session."}
        </p>
      )}

      {audience === "client" && active.length > 0 ? (
        <p className="mt-2.5 text-[12px] leading-[1.5] text-[color:var(--color-text-muted)]">
          These are training accommodations you and your coach talked through,
          never a diagnosis. Your training plans work around them.
        </p>
      ) : null}

      {adding ? (
        <div className="mt-3">
          <FlagComposer clientId={clientId} onDone={() => setAdding(false)} />
        </div>
      ) : null}

      {canManage && resolved.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-bark transition hover:text-amber-deep max-md:min-h-[36px]"
          >
            <History size={13} aria-hidden="true" />
            {showHistory ? "Hide resolved" : `Resolved (${resolved.length})`}
          </button>
          {showHistory ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {resolved.map((f) => (
                <li key={f.id} className="flex items-start gap-2.5 opacity-70">
                  <Check size={14} className="mt-[3px] shrink-0 text-bark" aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-[13px] leading-[1.5] text-[color:var(--color-text-muted)]">
                    <span className="font-medium text-ink">{f.know_text}</span>
                    {f.adjust_text ? <> · we adjusted: {f.adjust_text}</> : null}
                    {f.resolved_at ? (
                      <>
                        {" "}
                        · resolved{" "}
                        {new Date(f.resolved_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    onClick={() => reopen(f.id)}
                    className="shrink-0 rounded-full p-1.5 text-bark transition hover:bg-amber/20 max-md:min-h-[36px] max-md:min-w-[36px]"
                    aria-label={`Bring back flag: ${f.know_text}`}
                    title="Bring back"
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
