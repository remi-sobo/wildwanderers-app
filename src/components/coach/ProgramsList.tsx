"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Backpack, Users, CalendarClock, ChevronRight } from "lucide-react";
import { createProgram } from "@/lib/boys/actions";
import type { ProgramSummary, ProgramStatus } from "@/lib/data/boys";

const STATUS_STYLE: Record<ProgramStatus, string> = {
  active: "bg-[color:var(--color-state-good)]/12 text-[color:var(--color-state-good)]",
  setup: "bg-[color:var(--color-state-caution)]/15 text-[color:var(--color-state-caution)]",
  completed: "bg-inset text-[color:var(--color-text-muted)]",
  archived: "bg-inset text-[color:var(--color-text-faint)]",
};
const field = "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CreateProgram() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", location: "", start_date: "", end_date: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await createProgram(v);
      if (res.error) setError(res.error);
      else if (res.id) router.push(`/boys/${res.id}`);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep max-md:min-h-[44px]">
        <Plus size={16} strokeWidth={2.2} aria-hidden="true" /> New program
      </button>
    );
  }
  return (
    <div className="w-full rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="eyebrow mb-3 text-bark">New program</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={`${field} sm:col-span-2`} placeholder="Name, e.g. Fall After-School 2026"
          value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <input className={`${field} sm:col-span-2`} placeholder="Location (optional)"
          value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
        <label className="text-[12px] text-bark">Start
          <input type="date" className={`${field} mt-1 w-full`} value={v.start_date}
            onChange={(e) => setV({ ...v, start_date: e.target.value })} /></label>
        <label className="text-[12px] text-bark">End
          <input type="date" className={`${field} mt-1 w-full`} value={v.end_date}
            onChange={(e) => setV({ ...v, end_date: e.target.value })} /></label>
      </div>
      {error ? <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{error}</p> : null}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !v.name.trim()}
          className="rounded-full bg-amber px-5 py-2 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]">
          {pending ? "Creating" : "Create program"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="ww-link inline-flex items-center text-[13.5px] font-semibold text-forest max-md:min-h-[44px]">Cancel</button>
      </div>
    </div>
  );
}

export function ProgramsList({ programs }: { programs: ProgramSummary[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-[color:var(--color-text-muted)]">
          {programs.length === 0 ? "No programs yet" : `${programs.length} ${programs.length === 1 ? "program" : "programs"}`}
        </p>
        <CreateProgram />
      </div>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[color:var(--border-hair)] bg-card px-8 py-16 text-center shadow-[var(--shadow-card)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-inset text-forest">
            <Backpack size={22} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-[family-name:var(--font-display)] text-[20px] text-forest-deep">Start a program.</h2>
          <p className="mt-2 max-w-sm text-[14.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
            Create your first program, then add cohorts, the roster of kids and
            their parents, the schedule, and take attendance.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {programs.map((p) => (
            <li key={p.id}>
              <Link href={`/boys/${p.id}`}
                className="group flex h-full flex-col rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">{p.name}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[p.status]}`}>
                    {p.status}
                  </span>
                </div>
                {p.location ? <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">{p.location}</p> : null}
                <div className="mt-4 flex min-w-0 items-center gap-4 text-[13px] text-[color:var(--color-text-muted)]">
                  <span className="inline-flex shrink-0 items-center gap-1.5">
                    <Users size={15} className="text-forest" aria-hidden="true" /> {p.roster_count}
                  </span>
                  {p.next_session_at ? (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <CalendarClock size={15} className="shrink-0 text-forest" aria-hidden="true" />
                      <span className="truncate">{whenLabel(p.next_session_at)}</span>
                    </span>
                  ) : (
                    <span className="text-[color:var(--color-text-faint)]">No sessions yet</span>
                  )}
                  <ChevronRight size={16} className="ml-auto shrink-0 text-[color:var(--color-text-faint)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
