"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { submitTextCheckIn } from "@/lib/wellness/checkin-actions";
import type { CheckIn } from "@/lib/data/checkins";

// A client leaves a short reflection for Gabe. Voice is added in the next
// commit; this captures text. Coach structures it on Gabe's side, with his
// approval, never automatically.
export function CheckInCard({ recent }: { recent: CheckIn[] }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const res = await submitTextCheckIn(body);
      if (res.error) setError(res.error);
      else {
        setBody("");
        setSent(true);
      }
    });
  }

  return (
    <>
      <textarea
        value={body}
        onChange={(e) => {
          setSent(false);
          setBody(e.target.value);
        }}
        rows={3}
        placeholder="How did the week go? What felt good, what got in the way?"
        className="w-full rounded-xl border border-[color:var(--border-strong)] bg-canvas p-3 text-[14.5px] text-ink"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          className="rounded-full bg-amber px-5 py-2.5 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70"
        >
          {pending ? "Sending" : "Send check-in"}
        </button>
        {sent ? (
          <span className="flex items-center gap-1 text-[13px] text-fern">
            <Check size={15} /> Sent to Gabe
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 border-t border-[color:var(--border-hair)] pt-4">
          {recent.map((c) => (
            <li key={c.id} className="text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-text-muted)]">
                  {new Date(c.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-[11px] capitalize text-[color:var(--color-text-faint)]">
                  {c.status === "reviewed" ? "Gabe reviewed" : "Sent"}
                </span>
              </div>
              {c.body ? (
                <p className="mt-0.5 line-clamp-2 text-[color:var(--color-text)]">{c.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
