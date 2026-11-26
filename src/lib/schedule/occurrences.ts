// Where each template block actually sits in a given week
// (specs/schedule-overrides.md). The grid, the rollover and Today all
// read this, so a one-day move shows the same everywhere. Pure, no server
// imports; it ships in the client bundle and is unit tested.

import type { BlockRecur, BlockType } from "@/lib/schedule/blocks";

type DayKey = string; // yyyy-mm-dd

export type OccurrenceBlock = {
  id: string;
  day: number; // 0 = Monday
  start_min: number;
  end_min: number;
  title: string;
  block_type: BlockType;
  recur: BlockRecur;
  anchor_week: string | null;
};

export type BlockOverride = {
  block_id: string;
  on_date: string;
  new_date: string;
  start_min: number;
  end_min: number;
};

export type Occurrence<B extends OccurrenceBlock = OccurrenceBlock> = {
  block: B;
  /** The occurrence's own date (the template's weekday this week). */
  onDate: DayKey;
  /** Where it sits this week: the same unless moved for this day only. */
  date: DayKey;
  day: number;
  start: number;
  end: number;
  movedForDay: boolean;
};

function parse(key: DayKey): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDayKey(key: DayKey, n: number): DayKey {
  const dt = parse(key);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Whole weeks between two Mondays. */
function weeksBetween(fromMonday: DayKey, toMonday: DayKey): number {
  return Math.round((parse(toMonday).getTime() - parse(fromMonday).getTime()) / (7 * 86_400_000));
}

/** 1 for the first such weekday of its month, 2 for the second, and so on. */
function weekdayOrdinal(key: DayKey): number {
  return Math.ceil(parse(key).getUTCDate() / 7);
}

/**
 * Does the block occur in the week starting on this Monday? Weekly
 * always does. Without an anchor, the other repeats behave as they did
 * before anchors existed (every week), so no saved block changes.
 */
export function occursInWeek(block: Pick<OccurrenceBlock, "day" | "recur" | "anchor_week">, weekStart: DayKey): boolean {
  if (block.recur === "weekly" || !block.anchor_week) return true;
  const n = weeksBetween(block.anchor_week, weekStart);
  if (block.recur === "once") return n === 0;
  if (n < 0) return false;
  if (block.recur === "biweekly") return n % 2 === 0;
  // Monthly: the same nth weekday as the anchor week, for example the
  // second Tuesday of each month.
  return weekdayOrdinal(addDayKey(weekStart, block.day)) === weekdayOrdinal(addDayKey(block.anchor_week, block.day));
}

export function occurrencesForWeek<B extends OccurrenceBlock>(
  blocks: B[],
  overrides: BlockOverride[],
  weekStart: DayKey,
): Occurrence<B>[] {
  const byKey = new Map(overrides.map((o) => [`${o.block_id}|${o.on_date}`, o]));
  const out: Occurrence<B>[] = [];
  for (const b of blocks) {
    if (!occursInWeek(b, weekStart)) continue;
    const onDate = addDayKey(weekStart, b.day);
    const o = byKey.get(`${b.id}|${onDate}`);
    if (o) {
      const day = Math.round((parse(o.new_date).getTime() - parse(weekStart).getTime()) / 86_400_000);
      out.push({ block: b, onDate, date: o.new_date, day, start: o.start_min, end: o.end_min, movedForDay: true });
    } else {
      out.push({ block: b, onDate, date: onDate, day: b.day, start: b.start_min, end: b.end_min, movedForDay: false });
    }
  }
  return out.sort((a, b) => a.day - b.day || a.start - b.start);
}

/**
 * What a block would overlap at a spot, by name, so a move or a new
 * block can say "This overlaps Family small group". Travel is not a
 * clash; it is the gap between sessions.
 */
export function clashesAt<B extends OccurrenceBlock>(
  occurrences: Occurrence<B>[],
  spot: { day: number; start: number; end: number },
  ignoreBlockId?: string,
): Occurrence<B>[] {
  return occurrences.filter(
    (o) =>
      o.block.id !== ignoreBlockId &&
      o.block.block_type !== "travel" &&
      o.day === spot.day &&
      o.start < spot.end &&
      o.end > spot.start,
  );
}
