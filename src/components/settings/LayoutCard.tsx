"use client";

// The Layout card on /settings: the owner switches between the classic
// layout and the new one (Today, Week, Business, Messages). Owner only,
// and only where the deployment offers it. The choice lives on this
// device, so a phone and a laptop can differ.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOwnerHqLayout } from "@/lib/flags/actions";

export function LayoutCard({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(on: boolean) {
    setError(null);
    start(async () => {
      const res = await setOwnerHqLayout(on);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Layout</p>
      <p className="mt-2 text-[15px] text-forest-deep">
        {active ? "You are using the new layout." : "You are using the classic layout."}
      </p>
      <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
        The new layout puts Today, Week, Business and Messages up front, with everything else one
        tap away in Business. Nothing moves or changes in your data. This applies to this device
        only, and you can switch back any time.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => choose(!active)}
          className={`inline-flex min-h-[44px] items-center rounded-full px-5 text-[14px] font-semibold transition-colors disabled:opacity-60 ${
            active
              ? "border border-[color:var(--border-strong)] bg-card text-forest-deep hover:border-forest"
              : "bg-amber text-[#23170c] hover:bg-amber-deep"
          }`}
        >
          {pending ? "Saving" : active ? "Back to the classic layout" : "Try the new layout"}
        </button>
        {error ? (
          <p role="alert" className="text-[13px] text-[color:var(--color-state-error)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
