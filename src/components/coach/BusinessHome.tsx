"use client";

// The Business launchpad (owner HQ layout): what's coming up, four Quick
// access tiles the owner arranges, and the whole directory of business
// modules, every one linking to its existing page. Live lines are real
// counts or dates only; anything not yet verified shows its plain hint.
// Dates and "due today" are judged on this device's clock after mount,
// the same way the Schedule grid reads the viewer's week.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { BusinessHomeData, ComingUp } from "@/lib/data/business-home";
import {
  DIRECTORY,
  MODULES,
  QUICK_DEFAULT,
  QUICK_STORAGE_KEY,
  addTile,
  countDueBy,
  formatWhen,
  localDayKey,
  moveTileEarlier,
  parseQuickAccess,
  removeTile,
  type ModuleKey,
} from "@/lib/hq/business-home";
import { SignOutButton } from "@/components/shell/SignOutButton";

type Line = { text: string; alert?: boolean };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function comingUpTitle(c: ComingUp): string {
  return c.kind === "popup"
    ? `Pop-up, ${formatWhen(c.starts_at)}`
    : `${c.program_name}, ${formatWhen(c.starts_at)}`;
}

function comingUpHref(c: ComingUp): string {
  return c.kind === "popup" ? `/business/popup/${c.id}` : `/boys/${c.program_id}`;
}

export function BusinessHome({
  data,
  orgName,
  displayName,
  email,
}: {
  data: BusinessHomeData;
  orgName: string;
  displayName: string;
  email: string | null;
}) {
  const [today, setToday] = useState<string | null>(null);
  const [tiles, setTiles] = useState<ModuleKey[]>(QUICK_DEFAULT);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setToday(localDayKey(new Date()));
    try {
      setTiles(parseQuickAccess(window.localStorage.getItem(QUICK_STORAGE_KEY)));
    } catch {
      // Storage blocked (private window): the defaults stand.
    }
  }, []);

  function saveTiles(next: ModuleKey[]) {
    setTiles(next);
    try {
      window.localStorage.setItem(QUICK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not saved on this device; the arrangement lasts for this visit.
    }
  }

  const followUps = today ? countDueBy(data.followUpDues, today) : null;
  const tasksDue = today ? countDueBy(data.taskDues, today) : null;

  const comingUp: ComingUp | null =
    data.nextPopup && data.nextProgramSession
      ? data.nextPopup.starts_at <= data.nextProgramSession.starts_at
        ? data.nextPopup
        : data.nextProgramSession
      : data.nextPopup ?? data.nextProgramSession;

  function line(key: ModuleKey): Line {
    const hint = { text: MODULES[key].hint };
    if (key === "clients" && data.draftsToReview > 0) {
      return { text: `${plural(data.draftsToReview, "plan", "plans")} to review`, alert: true };
    }
    if (key === "boys" && data.nextProgramSession && today) {
      return { text: `Next: ${formatWhen(data.nextProgramSession.starts_at)}` };
    }
    if (key === "popup" && data.nextPopup && today) {
      return { text: formatWhen(data.nextPopup.starts_at) };
    }
    if (key === "leads" && followUps !== null) {
      const parts: string[] = [];
      if (followUps > 0) parts.push(`${followUps} to follow up`);
      if (data.newInquiries > 0) parts.push(plural(data.newInquiries, "new inquiry", "new inquiries"));
      return parts.length > 0 ? { text: parts.join(" · "), alert: true } : { text: "Nothing due" };
    }
    if (key === "tasks" && tasksDue !== null && tasksDue > 0) {
      return { text: `${tasksDue} due or overdue`, alert: true };
    }
    return hint;
  }

  function badge(key: ModuleKey): number | null {
    if (key === "leads" && followUps !== null) {
      const n = followUps + data.newInquiries;
      return n > 0 ? n : null;
    }
    return null;
  }

  const addable = (Object.keys(MODULES) as ModuleKey[]).filter((k) => !tiles.includes(k));

  return (
    <div className="flex max-w-[1120px] flex-col gap-4 md:gap-[18px]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">{orgName}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[27px] font-medium leading-[1.1] text-forest-deep">
          Business
        </h1>
      </div>

      {comingUp && today ? (
        <Link
          href={comingUpHref(comingUp)}
          className="flex items-center gap-3.5 rounded-[18px] bg-chrome px-4 py-3.5 text-bone"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-semibold uppercase tracking-[0.2em] text-cream">
              Coming up
            </span>
            <span className="mt-[3px] block font-[family-name:var(--font-display)] text-[19px] leading-tight">
              {comingUpTitle(comingUp)}
            </span>
            {comingUp.location ? (
              <span className="mt-0.5 block truncate text-[12.5px] text-bone/75">{comingUp.location}</span>
            ) : null}
          </span>
          <span className="shrink-0 rounded-full bg-amber px-3.5 py-2 text-[13px] font-semibold text-[#23170c]">
            Open
          </span>
        </Link>
      ) : null}

      <section aria-labelledby="quick-access">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <h2 id="quick-access" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
            Quick access
          </h2>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
            className="-mr-2 min-h-[44px] px-2 text-[12.5px] font-semibold text-amber-deep"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {tiles.map((key, i) => {
            const m = MODULES[key];
            const l = line(key);
            const Icon = m.icon;
            const body = (
              <>
                <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-inset text-forest">
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-[15px] font-bold text-forest-deep">{m.label}</span>
                <span
                  className={`text-[12px] leading-[1.35] ${
                    l.alert ? "font-bold text-amber-deep" : "text-[color:var(--color-text-muted)]"
                  }`}
                >
                  {l.text}
                </span>
              </>
            );
            return (
              <li
                key={key}
                className="relative rounded-[18px] border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]"
              >
                {editing ? (
                  <div className="flex min-h-[112px] flex-col gap-2.5 p-3.5" aria-label={m.label}>
                    {body}
                  </div>
                ) : (
                  <Link href={m.href} className="flex min-h-[112px] flex-col gap-2.5 rounded-[18px] p-3.5">
                    {body}
                  </Link>
                )}
                {editing ? (
                  <div className="absolute right-2 top-2 flex gap-1">
                    {i > 0 ? (
                      <button
                        type="button"
                        onClick={() => saveTiles(moveTileEarlier(tiles, key))}
                        aria-label={`Move ${m.label} earlier`}
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[color:var(--border-strong)] bg-card text-forest"
                      >
                        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => saveTiles(removeTile(tiles, key))}
                      aria-label={`Remove ${m.label}`}
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[color:var(--border-strong)] bg-card text-forest"
                    >
                      <X size={15} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {editing ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {addable.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => saveTiles(addTile(tiles, key))}
                className="min-h-[36px] rounded-full border border-dashed border-[color:var(--border-strong)] px-3 text-[12.5px] font-semibold text-forest max-md:min-h-[44px]"
              >
                + {MODULES[key].label}
              </button>
            ))}
          </div>
        ) : null}
        {editing && tiles.length === 0 ? (
          <p className="mt-2 px-1 text-[12.5px] text-[color:var(--color-text-muted)]">
            Add up to four places you open most.
          </p>
        ) : null}
      </section>

      <div className="grid items-start gap-3.5 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {DIRECTORY.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-bark">
              {group.label}
            </h2>
            <ul className="overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card">
              {group.keys.map((key, i) => {
                const m = MODULES[key];
                const Icon = m.icon;
                const n = badge(key);
                return (
                  <li key={key} className={i > 0 ? "border-t border-[color:var(--border-hair)]" : undefined}>
                    <Link href={m.href} className="flex min-h-[52px] items-center gap-3 px-3.5 py-[11px]">
                      <Icon size={19} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-forest" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold text-forest-deep">{m.label}</span>
                        <span className="block text-[12px] text-[color:var(--color-text-muted)]">{m.hint}</span>
                      </span>
                      {n ? (
                        <span className="rounded-full bg-amber px-2 py-0.5 text-[11.5px] font-bold text-[#23170c]">
                          {n}
                        </span>
                      ) : null}
                      <ChevronRight
                        size={17}
                        strokeWidth={1.75}
                        aria-hidden="true"
                        className="shrink-0 text-[color:var(--color-text-faint)]"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Phone only: the account and sign-out that used to sit in More. */}
      <section aria-label="Account" className="rounded-2xl bg-chrome px-4 py-4 text-bone md:hidden">
        <p className="truncate text-[13.5px] font-medium text-bone/90">{displayName}</p>
        {email ? <p className="truncate text-[12px] text-bone/50">{email}</p> : null}
        <SignOutButton tall className="mt-2" />
      </section>
    </div>
  );
}
