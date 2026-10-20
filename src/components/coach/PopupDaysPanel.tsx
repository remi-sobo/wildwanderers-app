"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronRight, ClipboardCheck } from "lucide-react";
import { createPopupDay } from "@/lib/popup/actions";
import type { PopupDay } from "@/lib/data/popup";

// The pop-up days: the next one up top with a big Take roll button, then the
// rest of the season, then a small form to add a day. Times render in the
// viewer's own time zone, so nothing here assumes a city.

const field =
  "h-11 w-full rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink outline-none focus:border-amber";

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function timeLabel(start: string, end: string | null) {
  const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return end ? `${t(start)} to ${t(end)}` : t(start);
}

export function PopupDaysPanel({ days }: { days: PopupDay[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:30");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Dates render in the viewer's time zone, so wait for the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // "Next" is the first day that has not ended yet, so on the morning of a
  // pop-up it is today's.
  const now = Date.now();
  const next = days.find((d) => new Date(d.ends_at ?? d.starts_at).getTime() + 3 * 3600_000 > now) ?? null;

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date) return setError("Pick a date.");
    startTransition(async () => {
      const res = await createPopupDay({
        starts_at: new Date(`${date}T${start}`).toISOString(),
        ends_at: end ? new Date(`${date}T${end}`).toISOString() : null,
        location,
      });
      if (res.error) return setError(res.error);
      setDate("");
      setLocation("");
      router.refresh();
    });
  }

  if (!mounted) return <div className="h-40 rounded-2xl bg-card shadow-[var(--shadow-card)]" aria-busy="true" />;

  return (
    <div className="flex flex-col gap-5">
      {next ? (
        <section className="rounded-2xl bg-forest-deep p-5 text-bone shadow-[var(--shadow-card)]">
          <p className="eyebrow text-[color:var(--color-cream)]">Next pop-up</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight">{dayLabel(next.starts_at)}</p>
          <p className="mt-1 text-[14px] text-bone/80">
            {timeLabel(next.starts_at, next.ends_at)}
            {next.location ? ` · ${next.location}` : ""}
          </p>
          <Link
            href={`/business/popup/${next.id}`}
            className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-amber text-[16px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep"
          >
            <ClipboardCheck size={20} strokeWidth={2} aria-hidden="true" />
            Take roll
          </Link>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-[color:var(--border-hair)] px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">The season</h2>
        </div>
        {days.length === 0 ? (
          <p className="p-5 text-[13.5px] text-[color:var(--color-text-muted)]">No pop-up days yet. Add the first one below.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
            {days.map((d) => {
              const past = new Date(d.ends_at ?? d.starts_at).getTime() < now;
              return (
                <li key={d.id}>
                  <Link
                    href={`/business/popup/${d.id}`}
                    className="flex min-h-[56px] items-center justify-between gap-3 px-5 py-3 hover:bg-inset"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14.5px] text-forest-deep">{dayLabel(d.starts_at)}</span>
                      <span className="block text-[12.5px] text-[color:var(--color-text-muted)]">
                        {timeLabel(d.starts_at, d.ends_at)}
                        {d.location ? ` · ${d.location}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[12.5px] text-[color:var(--color-text-muted)]">
                      {past || d.here > 0 ? `${d.here} came${d.free ? `, ${d.free} free` : ""}` : "Upcoming"}
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form onSubmit={add} className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 text-forest-deep">
          <CalendarPlus size={18} aria-hidden="true" />
          <h2 className="font-[family-name:var(--font-display)] text-[17px]">Add a pop-up day</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className={field} type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={field} type="time" aria-label="Start" value={start} onChange={(e) => setStart(e.target.value)} />
          <input className={field} type="time" aria-label="End" value={end} onChange={(e) => setEnd(e.target.value)} />
          <input className={field} placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
          >
            {pending ? "Adding..." : "Add day"}
          </button>
          {error ? <span className="text-[13px] text-[color:var(--color-state-error)]">{error}</span> : null}
        </div>
      </form>
    </div>
  );
}
