import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getMyClient } from "@/lib/data/training";
import { getMyIntakeAndFlags, assessedAgoLabel, getLastAssessedForClient } from "@/lib/data/intake";
import { getRecentSessionsForClient } from "@/lib/data/sessions";
import { FlagsBand } from "@/components/coach/FlagsBand";
import { SessionNotes } from "@/components/coach/SessionNotes";
import { EmptyState } from "@/components/ui/EmptyState";

// The client's own record, in full: their goal in their own words, the
// story from their intake, what training works around, and the notes from
// their sessions. Their body, their data; nothing about them is hidden
// except nothing, because there is nothing else. Transparency is part of
// the product.

export default async function MyProfilePage() {
  const client = await getMyClient();
  if (!client) {
    return (
      <EmptyState title="Your profile lives here.">
        Once your coach sets up your record, your goal, your story, and your
        progress all show up on this page.
      </EmptyState>
    );
  }

  const [{ intake, flags }, sessions, lastAssessed] = await Promise.all([
    getMyIntakeAndFlags(client.id),
    getRecentSessionsForClient(client.id, 10),
    getLastAssessedForClient(client.id),
  ]);

  const cadence = assessedAgoLabel(lastAssessed);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow text-bark">Your profile</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          {client.goal ? <>&ldquo;{client.goal}&rdquo;</> : "Your record, in your words."}
        </h1>
        <p className="mt-1.5 max-w-xl text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
          {client.goal
            ? "The goal you set, the way you said it. Everything below is your record, and all of it is yours to see."
            : "Your goal lands here after your first conversation with your coach."}
        </p>
      </div>

      <FlagsBand clientId={client.id} flags={flags} variant="full" audience="client" />

      {intake?.story_md || intake?.lifestyle_md ? (
        <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
            Your story
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
            What you and your coach talked through when you started. If
            anything here has changed, say so at your next session.
          </p>
          {intake?.story_md ? (
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
              {intake.story_md}
            </p>
          ) : null}
          {intake?.lifestyle_md ? (
            <>
              <h3 className="mt-4 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-bark">
                Your week
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
                {intake.lifestyle_md}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      <Link
        href="/progress"
        className="group flex items-center gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inset text-forest">
          <TrendingUp size={18} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
            Your progress
          </p>
          <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
            Graphs, your wellness score, and your fitness tests
            {cadence ? `, ${cadence}` : ""}.
          </p>
        </div>
      </Link>

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
          Session notes
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          Your coach&apos;s one-liners after each session.
        </p>
        <div className="mt-3">
          <SessionNotes sessions={sessions} clientId={client.id} canEdit={false} />
        </div>
      </section>
    </div>
  );
}
