import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft, ClipboardList, Dumbbell, MessageCircle } from "lucide-react";
import { getClientById, clientName } from "@/lib/data/clients";
import { getPlanForClient } from "@/lib/data/plans";
import { getUpcomingSessionsForClient } from "@/lib/data/sessions";
import { openThreadWithClient } from "@/lib/messaging/actions";
import { ScheduleSessionForm } from "@/components/coach/ScheduleSessionForm";
import { EmptyState } from "@/components/ui/EmptyState";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const [plan, sessions] = await Promise.all([
    getPlanForClient(id),
    getUpcomingSessionsForClient(id),
  ]);

  const openThread = openThreadWithClient.bind(null, id);

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
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[30px] leading-tight text-forest-deep">
              {clientName(client)}
            </h1>
            {client.goal ? (
              <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
                {client.goal}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <form action={openThread}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset"
              >
                <MessageCircle size={15} aria-hidden="true" />
                Message
              </button>
            </form>
            <Link
              href={`/program/clients/${id}/plan/new`}
              className="rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep"
            >
              {plan ? "New plan" : "Build a plan"}
            </Link>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
          Sessions
        </h2>
        {sessions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]"
              >
                <CalendarClock size={16} className="shrink-0 text-forest" aria-hidden="true" />
                <span className="flex-1 text-[14px] text-[color:var(--color-text)]">{s.title}</span>
                <span className="text-[12.5px] text-[color:var(--color-text-muted)]">
                  {formatWhen(s.start_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
            No upcoming sessions.
          </p>
        )}
        <ScheduleSessionForm clientId={id} />
      </section>

      {/* Plan */}
      {plan ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
              {plan.title}
            </h2>
            <span className="rounded-full bg-[color:var(--color-state-good)]/12 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-[color:var(--color-state-good)]">
              {plan.status}
            </span>
          </div>

          {plan.workouts.length === 0 ? (
            <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
              This plan has no workouts yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {plan.workouts.map((w) => (
                <li
                  key={w.id}
                  className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                    Week {w.week_number} · Day {w.day_number}
                  </span>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
                    {w.title || `Workout ${w.day_number}`}
                  </p>
                  <ul className="mt-3 flex flex-col divide-y divide-[color:var(--border-hair)]">
                    {w.exercises.map((ex) => (
                      <li key={ex.id} className="flex items-center gap-3 py-2.5">
                        <Dumbbell size={15} aria-hidden="true" className="shrink-0 text-fern" />
                        <span className="flex-1 text-[14px] text-[color:var(--color-text)]">
                          {ex.title}
                          {ex.is_optional ? (
                            <span className="ml-2 text-[11px] text-[color:var(--color-text-faint)]">
                              optional
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[12.5px] tabular-nums text-[color:var(--color-text-muted)]">
                          {[ex.sets ? `${ex.sets}×` : "", ex.reps ?? ""].join("").trim() || ex.load || ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <EmptyState icon={ClipboardList} title="No plan yet.">
          Build {client.first_name}&apos;s first training plan and it shows up here,
          ready for them to train.
        </EmptyState>
      )}
    </div>
  );
}
