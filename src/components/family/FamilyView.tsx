import { CalendarClock, Award, CircleCheck, Compass, FileWarning } from "lucide-react";
import { Ridgeline } from "@/components/brand/Ridgeline";
import type { FamilyChild } from "@/lib/data/family";

const ADVENTURE_LABEL: Record<string, string> = {
  journal: "Nature journal",
  check_in: "Check-in",
};

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
const STATUS_STYLE: Record<string, string> = {
  present: "text-fern",
  late: "text-[color:var(--color-state-caution)]",
  absent: "text-[color:var(--color-text-muted)]",
};

// The parent's read-only view of their kids in the boys program. Warm, simple,
// no controls: the schedule, how the week went, and the badges they earned.
export function FamilyView({
  children,
  firstName,
  orgName = "Wild Wanderers",
}: {
  children: FamilyChild[];
  firstName?: string;
  orgName?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl bg-chrome shadow-[var(--shadow-card)]">
        <Ridgeline className="absolute inset-x-0 bottom-0 h-20 w-full" />
        <div className="relative z-10 px-6 pb-10 pt-7">
          <p className="eyebrow text-[10px] text-bone/60">{orgName}</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-tight text-bone">
            {firstName ? `Hi ${firstName}.` : "Your family."}
          </h1>
          <p className="mt-1 text-[14px] text-bone/70">The boys program, at a glance.</p>
        </div>
      </section>

      {children.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 text-[14px] leading-[1.55] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
          Nothing here yet. Once your child is on a program roster, their schedule,
          attendance, and badges show up here.
        </div>
      ) : (
        children.map((kid) => (
          <section key={kid.id} className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-[color:var(--border-hair)] px-5 py-4">
              <h2 className="font-[family-name:var(--font-display)] text-[19px] text-forest-deep">
                {kid.first_name} {kid.last_name}
              </h2>
              <p className="text-[13px] text-[color:var(--color-text-muted)]">
                {kid.program_name}{kid.cohort_name ? ` · ${kid.cohort_name}` : ""}
              </p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <CalendarClock size={15} className="text-forest" aria-hidden="true" />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">Coming up</h3>
                </div>
                {kid.upcoming.length === 0 ? (
                  <p className="text-[13px] text-[color:var(--color-text-muted)]">No sessions scheduled.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {kid.upcoming.map((s) => (
                      <li key={s.id} className="text-[13.5px]">
                        <span className="text-forest-deep">{s.title}</span>
                        <span className="block text-[12px] text-[color:var(--color-text-muted)]">
                          {whenLabel(s.starts_at)}{s.location ? ` · ${s.location}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <CircleCheck size={15} className="text-forest" aria-hidden="true" />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">Recent days</h3>
                </div>
                {kid.recentAttendance.length === 0 ? (
                  <p className="text-[13px] text-[color:var(--color-text-muted)]">Nothing logged yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {kid.recentAttendance.map((a, i) => (
                      <li key={i} className="flex items-center justify-between text-[13px]">
                        <span className="min-w-0 truncate text-[color:var(--color-text)]">{a.session_title}</span>
                        <span className={`shrink-0 capitalize ${STATUS_STYLE[a.status] ?? ""}`}>{a.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {kid.formsToSign.length > 0 ? (
              <div className="border-t border-[color:var(--border-hair)] bg-[color:var(--color-state-caution)]/8 px-5 py-4">
                <div className="flex items-start gap-2">
                  <FileWarning size={15} className="mt-0.5 shrink-0 text-[color:var(--color-state-caution)]" aria-hidden="true" />
                  <p className="text-[13px] text-forest-deep">
                    Still to sign for {kid.first_name}: {kid.formsToSign.join(", ")}. Your coach will help you complete these.
                  </p>
                </div>
              </div>
            ) : null}

            {kid.badges.length > 0 ? (
              <div className="border-t border-[color:var(--border-hair)] px-5 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <Award size={15} className="text-forest" aria-hidden="true" />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">Badges earned</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {kid.badges.map((b) => (
                    <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3 py-1 text-[13px] text-forest-deep" title={b.note ?? undefined}>
                      <span aria-hidden="true">{b.emoji ?? "🏅"}</span> {b.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {kid.adventure.length > 0 ? (
              <div className="border-t border-[color:var(--border-hair)] px-5 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <Compass size={15} className="text-forest" aria-hidden="true" />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">His adventure</h3>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {kid.adventure.map((e) => (
                    <li key={e.id} className="border-l-2 border-[color:var(--color-fern)] pl-3">
                      <p className="text-[12px] text-bark">
                        {ADVENTURE_LABEL[e.kind] ?? "Note"} · {new Date(e.entry_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                      {e.title ? <p className="text-[13.5px] font-medium text-forest-deep">{e.title}</p> : null}
                      <p className="text-[13.5px] leading-[1.5] text-[color:var(--color-text)]">{e.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))
      )}
    </div>
  );
}
