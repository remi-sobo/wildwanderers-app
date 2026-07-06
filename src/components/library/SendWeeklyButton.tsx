"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, Mail } from "lucide-react";
import { sendWeeklyNote } from "@/lib/library/email-actions";

// Send a published post as the weekly note to members and subscribers. A
// deliberate, confirmed action, never automatic on every save, so a note goes
// out exactly when Gabe means it to. Shows when it last went out and how many
// real recipients it reached.
export function SendWeeklyButton({
  postId,
  status,
  sentAt,
}: {
  postId: string;
  status: "draft" | "published";
  sentAt: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; sent: number; error: string | null } | null>(null);

  function send() {
    setResult(null);
    start(async () => {
      const res = await sendWeeklyNote(postId);
      setResult(res);
      setConfirming(false);
      if (res.ok) router.refresh();
    });
  }

  const lastSent = sentAt
    ? new Date(sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-forest" aria-hidden="true" />
        <p className="eyebrow text-bark">Weekly note</p>
      </div>

      {status !== "published" ? (
        <p className="mt-3 text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
          Publish this post first, then you can send it to members and subscribers as the
          weekly trail note.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
            Send this post to members and everyone on the trail-note list. It goes out from
            the app, with the Trailhead Library name in the subject.
            {lastSent ? ` Last sent ${lastSent}.` : ""}
          </p>

          {result?.ok ? (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fern/15 px-3 py-1.5 text-[13px] font-semibold text-[color:var(--color-state-good)]">
              <Check size={14} aria-hidden="true" />
              Sent to {result.sent} {result.sent === 1 ? "person" : "people"}
            </p>
          ) : confirming ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[color:var(--color-text-muted)]">
                Send it now{lastSent ? " again" : ""}?
              </span>
              <button
                type="button"
                onClick={send}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70"
              >
                <Send size={14} aria-hidden="true" />
                {pending ? "Sending" : "Send now"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-full px-3 py-2 text-[13px] font-semibold text-forest"
              >
                Not yet
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-forest/30 px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-forest/5"
            >
              <Send size={14} aria-hidden="true" />
              {lastSent ? "Send again" : "Send as the weekly note"}
            </button>
          )}

          {result && !result.ok ? (
            <p role="alert" className="mt-3 text-[13px] text-[color:var(--color-state-error)]">
              {result.error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
