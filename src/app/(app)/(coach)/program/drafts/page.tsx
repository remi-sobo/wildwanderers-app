import Link from "next/link";
import { ChevronLeft, FileText, Inbox, Send, Sparkles } from "lucide-react";
import { getDraftsAcrossClients, type InboxDraft } from "@/lib/data/plans";
import { activateDraft, discardDraft, markSelfWorkoutReviewed } from "@/lib/coach/actions";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Drafts — Wild Wanderers" };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DraftRow({ d }: { d: InboxDraft }) {
  const fromClient = d.initiated_by === "client";
  const activate = activateDraft.bind(null, d.client_id, d.id);
  const discard = discardDraft.bind(null, d.client_id, d.id);
  const markReviewed = markSelfWorkoutReviewed.bind(null, d.client_id, d.id);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <FileText size={16} className="shrink-0 text-bark" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[color:var(--color-text)]">
          <Link
            href={`/program/clients/${d.client_id}`}
            className="font-semibold text-forest-deep hover:text-forest"
          >
            {d.client_name}
          </Link>
          {" · "}
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
          href={`/program/clients/${d.client_id}/plan/new?draft=${d.id}`}
          className="rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset"
        >
          Review
        </Link>
        {fromClient ? (
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
}

// The org-wide drafts inbox: everything resting, across every client, with
// what the clients sent first. The per-client lists stay where they are; this
// is the one place Gabe checks without making the rounds.
export default async function DraftsInboxPage() {
  const drafts = await getDraftsAcrossClients();
  const waiting = drafts.filter((d) => d.initiated_by === "client");
  const own = drafts.filter((d) => d.initiated_by !== "client");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/program"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Program
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Drafts
        </h1>
        <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
          Everything resting, across every client. What they sent you comes first.
        </p>
      </div>

      {drafts.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing waiting.">
          Drafts you save and workouts clients send for a look gather here.
        </EmptyState>
      ) : (
        <>
          {waiting.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-[19px] text-forest-deep">
                Waiting on you
              </h2>
              <ul className="flex flex-col gap-2">
                {waiting.map((d) => (
                  <DraftRow key={d.id} d={d} />
                ))}
              </ul>
            </section>
          ) : null}
          {own.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-[19px] text-forest-deep">
                Your drafts
              </h2>
              <ul className="flex flex-col gap-2">
                {own.map((d) => (
                  <DraftRow key={d.id} d={d} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
