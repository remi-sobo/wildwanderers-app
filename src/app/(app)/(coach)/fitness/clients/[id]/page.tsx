import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  MessageCircle,
  NotebookPen,
  Sun,
} from "lucide-react";
import { getClientById, clientName } from "@/lib/data/clients";
import { getClientIntake, getClientFlags, getLastAssessedForClient, assessedAgoLabel } from "@/lib/data/intake";
import { getClientLongevity } from "@/lib/data/longevity";
import { getClientWellness } from "@/lib/data/coach-fitness";
import { getPlanForClient } from "@/lib/data/plans";
import {
  getUpcomingSessionsForClient,
  getRecentSessionsForClient,
  getTodaySessionForClient,
} from "@/lib/data/sessions";
import { openThreadWithClient } from "@/lib/messaging/actions";
import { FlagsBand } from "@/components/coach/FlagsBand";
import { SessionNotes } from "@/components/coach/SessionNotes";
import { ClientLongevityPanel } from "@/components/coach/ClientLongevityPanel";

// The full client profile, designed around the thirty-second pre-session
// glance. Above the fold: the flags band, the goal in their words, the
// schedule, the last session's note, and today's session if there is one.
// Below: the intake record, assessments, training, wellness, and the
// session notes over time. Most sections read what already exists; the
// glance is the point.

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const [intake, flags, longevity, wellness, plan, upcoming, recent, today, lastAssessed] =
    await Promise.all([
      getClientIntake(id),
      getClientFlags(id),
      getClientLongevity(id),
      getClientWellness(id),
      getPlanForClient(id),
      getUpcomingSessionsForClient(id),
      getRecentSessionsForClient(id, 10),
      getTodaySessionForClient(id),
      getLastAssessedForClient(id),
    ]);

  const lastNote = recent.find((s) => s.notes);
  const cadence = assessedAgoLabel(lastAssessed);
  const openThread = openThreadWithClient.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href="/fitness"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest max-md:min-h-[44px]"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Fitness
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-[30px] leading-tight text-forest-deep">
              {clientName(client)}
            </h1>
            {client.goal ? (
              <p className="mt-1.5 max-w-xl font-[family-name:var(--font-display)] text-[17px] leading-[1.45] text-bark">
                &ldquo;{client.goal}&rdquo;
              </p>
            ) : (
              <p className="mt-1.5 text-[14px] text-[color:var(--color-text-muted)]">
                No goal written yet. It comes from the intake, in their words.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <form action={openThread}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset max-md:min-h-[44px]"
              >
                <MessageCircle size={15} aria-hidden="true" />
                Message
              </button>
            </form>
            <Link
              href={`/program/clients/${id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset max-md:min-h-[44px]"
            >
              <ClipboardList size={15} aria-hidden="true" />
              Program
            </Link>
            <Link
              href={`/fitness/clients/${id}/intake`}
              className="inline-flex items-center rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep max-md:min-h-[44px]"
            >
              {intake ? "Open intake" : "Start intake"}
            </Link>
          </div>
        </div>
      </div>

      {/* The standing flags, always first. */}
      <FlagsBand clientId={id} flags={flags} variant="full" />

      {/* The glance row: today, the schedule, the last note. */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
            <Sun size={13} aria-hidden="true" />
            Today
          </p>
          {today ? (
            <>
              <p className="mt-2 text-[14.5px] font-semibold text-forest-deep">{today.title}</p>
              <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
                {fmtWhen(today.start_at)}
                {today.location ? ` · ${today.location}` : ""}
              </p>
              {plan ? (
                <p className="mt-1.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                  On the plan: {plan.title}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[13.5px] text-[color:var(--color-text-muted)]">
              No session today.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
            <CalendarClock size={13} aria-hidden="true" />
            Schedule
          </p>
          {upcoming.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {upcoming.slice(0, 3).map((s) => (
                <li key={s.id} className="text-[13px] leading-[1.45] text-ink">
                  <span className="font-medium">{fmtWhen(s.start_at)}</span>
                  <span className="text-[color:var(--color-text-muted)]"> · {s.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13.5px] text-[color:var(--color-text-muted)]">
              Nothing scheduled. Set the next one on their Program page.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
            <NotebookPen size={13} aria-hidden="true" />
            Last session
          </p>
          {lastNote ? (
            <>
              <p className="mt-2 text-[13.5px] leading-[1.5] text-ink">{lastNote.notes}</p>
              <p className="mt-1 text-[12px] text-[color:var(--color-text-faint)]">
                {fmtWhen(lastNote.start_at)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13.5px] text-[color:var(--color-text-muted)]">
              No note yet. Jot one line below after a session.
            </p>
          )}
        </div>
      </div>

      {/* The intake record */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
            The story
          </h2>
          <Link
            href={`/fitness/clients/${id}/intake`}
            className="text-[13px] font-semibold text-forest transition-colors hover:text-forest-deep max-md:min-h-[44px] max-md:inline-flex max-md:items-center"
          >
            Edit in intake
          </Link>
        </div>
        {intake?.story_md ? (
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
            {intake.story_md}
          </p>
        ) : (
          <p className="mt-3 text-[13.5px] text-[color:var(--color-text-muted)]">
            Not written yet. The intake captures their history in their words.
          </p>
        )}
        {intake?.lifestyle_md ? (
          <>
            <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-bark">
              Lifestyle
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
              {intake.lifestyle_md}
            </p>
          </>
        ) : null}
      </section>

      {/* Assessments: pillars, bands, trends, with the cadence line. */}
      <section className="flex flex-col gap-2">
        {cadence ? (
          <p className="text-[13px] text-[color:var(--color-text-muted)]">
            {cadence[0].toUpperCase() + cadence.slice(1)}.
          </p>
        ) : null}
        <ClientLongevityPanel clientId={id} longevity={longevity} />
      </section>

      {/* Training and wellness, reads over what exists. */}
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href={`/program/clients/${id}`}
          className="group flex items-center gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inset text-forest">
            <ClipboardList size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
              Training
            </p>
            <p className="truncate text-[13.5px] text-[color:var(--color-text-muted)]">
              {plan ? plan.title : "No active plan. Build one from Program."}
            </p>
          </div>
        </Link>
        {wellness.hasConsent ? (
          <Link
            href={`/fitness?c=${id}`}
            className="group flex items-center gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inset text-forest">
              <Activity size={18} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                Wellness
              </p>
              <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
                {wellness.score?.score != null
                  ? "A progress signal, never a medical read."
                  : "Consented, building as they log."}
              </p>
            </div>
            {wellness.score?.score != null ? (
              <span className="shrink-0 font-[family-name:var(--font-display)] text-[28px] leading-none text-forest-deep">
                {wellness.score.score}
              </span>
            ) : null}
          </Link>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inset text-forest">
              <Activity size={18} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                Wellness
              </p>
              <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
                Not tracking yet. It opens once they consent in their app.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Session notes over time */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
          Session notes
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          One line after each session. The client reads these too.
        </p>
        <div className="mt-3">
          <SessionNotes sessions={recent} clientId={id} />
        </div>
      </section>
    </div>
  );
}
