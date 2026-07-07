import Link from "next/link";
import { FileText, Send, Sparkles } from "lucide-react";
import type { DraftPlanSummary } from "@/lib/data/plans";
import { activateDraft, discardDraft, markSelfWorkoutReviewed } from "@/lib/coach/actions";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// The resting drafts for one client: open in the builder to review, activate
// as-is, or discard. Server component; the buttons are small action forms.
export function DraftPlansList({
  clientId,
  drafts,
}: {
  clientId: string;
  drafts: DraftPlanSummary[];
}) {
  if (drafts.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
        Drafts
      </h2>
      <ul className="flex flex-col gap-2">
        {drafts.map((d) => {
          const fromClient = d.initiated_by === "client";
          const activate = activateDraft.bind(null, clientId, d.id);
          const discard = discardDraft.bind(null, clientId, d.id);
          const markReviewed = markSelfWorkoutReviewed.bind(null, clientId, d.id);
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
            >
              <FileText size={16} className="shrink-0 text-bark" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[color:var(--color-text)]">
                  {d.title}
                </p>
                <p className="truncate text-[12px] text-[color:var(--color-text-muted)]">
                  {fromClient
                    ? "Their own workout, sent for your eyes"
                    : d.ai_generated && d.origin_prompt
                      ? `Scout, from: ${d.origin_prompt}`
                      : `Started ${formatDay(d.created_at)}`}
                </p>
              </div>
              {fromClient ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber/15 px-2.5 py-1 text-[11px] font-semibold text-amber-deep">
                  <Send size={11} aria-hidden="true" />
                  From the client
                </span>
              ) : d.ai_generated ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--color-fern)]/12 px-2.5 py-1 text-[11px] font-semibold text-forest">
                  <Sparkles size={11} aria-hidden="true" />
                  Scout drafted
                </span>
              ) : null}
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/program/clients/${clientId}/plan/new?draft=${d.id}`}
                  className="rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset"
                >
                  Review
                </Link>
                {fromClient ? (
                  // Their workout stays theirs: mark it looked-at, never
                  // activate it as their plan, never discard it for them.
                  <form action={markReviewed}>
                    <button
                      type="submit"
                      className="rounded-full bg-forest px-3.5 py-1.5 text-[12.5px] font-semibold text-bone transition-colors hover:bg-forest-deep"
                    >
                      Mark reviewed
                    </button>
                  </form>
                ) : (
                  <>
                    <form action={activate}>
                      <button
                        type="submit"
                        className="rounded-full bg-amber px-3.5 py-1.5 text-[12.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep"
                      >
                        Activate
                      </button>
                    </form>
                    <form action={discard}>
                      <button
                        type="submit"
                        className="text-[12.5px] font-semibold text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
                      >
                        Discard
                      </button>
                    </form>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
