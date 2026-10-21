// Pure pieces of the owner HQ Today page: which real tasks show, and
// today's agenda from the recurring schedule blocks plus booked sessions.
// No server imports; it ships in the client bundle and is unit tested.

import type { BlockType, BlockRecur } from "@/lib/schedule/blocks";

type TodayTaskInput = {
  id: string;
  status: string;
  pin_today: boolean;
  due_date: string | null;
};

/** Pinned tasks keep their existing meaning; due and overdue come next. */
export function selectTodayTasks<T extends TodayTaskInput>(
  tasks: T[],
  todayKey: string,
): { pinned: T[]; due: T[] } {
  const open = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  const pinned = open.filter((t) => t.pin_today);
  const due = open
    .filter((t) => !t.pin_today && t.due_date !== null && t.due_date.slice(0, 10) <= todayKey)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));
  return { pinned, due };
}

/** Monday is 0, matching schedule_blocks.day. */
export function weekdayIndex(now: Date): number {
  return (now.getDay() + 6) % 7;
}

export type AgendaBlock = {
  kind: "block";
  id: string;
  start: number;
  end: number;
  title: string;
  location: string | null;
  blockType: BlockType;
  recur: BlockRecur;
};
export type AgendaSession = {
  kind: "session";
  id: string;
  start: number;
  end: number | null;
  title: string;
  location: string | null;
};
export type AgendaItem = AgendaBlock | AgendaSession;

type BlockInput = {
  id: string;
  day: number;
  start_min: number;
  end_min: number;
  title: string;
  location: string | null;
  block_type: BlockType;
  recur: BlockRecur;
};
type SessionInput = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
};

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Today's blocks (the weekly template, as the Schedule grid shows it) and
 * today's booked sessions, in time order. Missing sources simply add
 * nothing; nothing here claims a gap is free time.
 */
export function buildAgenda(blocks: BlockInput[], sessions: SessionInput[], now: Date): AgendaItem[] {
  const day = weekdayIndex(now);
  const items: AgendaItem[] = blocks
    .filter((b) => b.day === day)
    .map((b) => ({
      kind: "block" as const,
      id: b.id,
      start: b.start_min,
      end: b.end_min,
      title: b.title,
      location: b.location,
      blockType: b.block_type,
      recur: b.recur,
    }));
  for (const s of sessions) {
    const start = new Date(s.start_at);
    if (!sameLocalDay(start, now)) continue;
    const end = s.end_at ? new Date(s.end_at) : null;
    items.push({
      kind: "session",
      id: s.id,
      start: minutesOf(start),
      end: end && sameLocalDay(end, now) ? minutesOf(end) : null,
      title: s.title,
      location: s.location,
    });
  }
  return items.sort((a, b) => a.start - b.start);
}

/** The next thing that has not started yet, skipping travel. */
export function nextUp(agenda: AgendaItem[], now: Date): AgendaItem | null {
  const m = minutesOf(now);
  return (
    agenda.find((i) => i.start > m && !(i.kind === "block" && i.blockType === "travel")) ?? null
  );
}

/** "Due today" or "Overdue, was Oct 16". */
export function dueLabel(due: string, todayKey: string): { text: string; overdue: boolean } {
  const key = due.slice(0, 10);
  if (key >= todayKey) return { text: "Due today", overdue: false };
  const [y, mo, d] = key.split("-").map(Number);
  const when = new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { text: `Overdue, was ${when}`, overdue: true };
}
