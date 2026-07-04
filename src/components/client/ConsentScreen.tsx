"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Check } from "lucide-react";
import { grantConsent } from "@/lib/wellness/actions";
import { Ridgeline } from "@/components/brand/Ridgeline";

// The one-time consent screen, shown the first time a client opens tracking.
// Plain about what is tracked and how it is used. The wellness score note
// makes clear it is a progress signal, never a medical assessment.
export function ConsentScreen({
  orgName = "Wild Wanderers",
  coachName,
}: {
  orgName?: string;
  coachName?: string;
}) {
  const coach = coachName?.trim() || "your coach";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function agree() {
    setError(null);
    startTransition(async () => {
      const result = await grantConsent();
      if (result.error) setError(result.error);
      // On success the action revalidates /log and the hub renders.
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl bg-chrome shadow-[var(--shadow-card)]">
        <Ridgeline className="absolute inset-x-0 bottom-0 h-20 w-full" />
        <div className="relative z-10 px-6 pb-10 pt-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bone/10 text-bone">
            <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-[24px] leading-tight text-bone">
            Before you start logging.
          </h1>
          <p className="mt-2 max-w-md text-[14.5px] leading-[1.55] text-bone/70">
            Tracking gives you and {coach} a real picture to coach from. Here is
            what it covers, in plain terms.
          </p>
        </div>
      </section>

      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
        <ul className="flex flex-col gap-4">
          {[
            [
              "What you log",
              "Weight and body measurements, habits, movement, and food, whenever you choose. Every field is optional. Log what you have.",
            ],
            [
              "Who can see it",
              `Only you and ${coach}. No other client sees your data, and it never leaves ${orgName}. Access is recorded.`,
            ],
            [
              "How it is used",
              `To shape your training and habits and to show your progress over time. Your wellness score is a motivating progress number, not a medical or health assessment, and ${coach} coaches as a certified trainer, not a clinician.`,
            ],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-inset text-forest">
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-forest-deep">{title}</p>
                <p className="mt-0.5 text-[13.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={agree}
          disabled={pending}
          className="submit"
          style={{ marginTop: 28 }}
        >
          <span className="submit-label">
            {pending ? "One moment" : "I agree, open my tracker"}
          </span>
        </button>
        {error ? (
          <p role="alert" className="mt-3 text-center text-[13px] text-[color:var(--color-state-error)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
