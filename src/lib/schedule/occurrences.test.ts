import { describe, expect, it } from "vitest";
import { addDayKey, clashesAt, occurrencesForWeek, occursInWeek, type OccurrenceBlock } from "./occurrences";

const block = (id: string, day: number, start: number, end: number, extra: Partial<OccurrenceBlock> = {}): OccurrenceBlock => ({
  id,
  day,
  start_min: start,
  end_min: end,
  title: id,
  block_type: "admin",
  recur: "weekly",
  anchor_week: null,
  ...extra,
});

// Monday 2026-10-19; Thursday is 2026-10-22, next Thursday 2026-10-29.
const WEEK = "2026-10-19";
const NEXT = "2026-10-26";

describe("one-day moves", () => {
  const thu = block("thu", 3, 600, 660);
  const move = { block_id: "thu", on_date: "2026-10-22", new_date: "2026-10-23", start_min: 840, end_min: 900 };

  it("a one-off Thursday move leaves next Thursday unchanged", () => {
    const [moved] = occurrencesForWeek([thu], [move], WEEK);
    expect(moved).toMatchObject({ onDate: "2026-10-22", date: "2026-10-23", day: 4, start: 840, end: 900, movedForDay: true });

    const [next] = occurrencesForWeek([thu], [move], NEXT);
    expect(next).toMatchObject({ onDate: "2026-10-29", date: "2026-10-29", day: 3, start: 600, end: 660, movedForDay: false });
  });

  it("an override for another block or date changes nothing", () => {
    const other = { ...move, block_id: "other" };
    const [o] = occurrencesForWeek([thu], [other, { ...move, on_date: "2026-10-29" }], WEEK);
    expect(o).toMatchObject({ day: 3, start: 600, movedForDay: false });
  });

  it("sorts by the day and time each occurrence actually sits", () => {
    const fri = block("fri", 4, 600, 660);
    const out = occurrencesForWeek([fri, thu], [move], WEEK);
    expect(out.map((o) => o.block.id)).toEqual(["fri", "thu"]);
  });
});

describe("repeats", () => {
  it("weekly and unanchored repeats occur every week, as before anchors existed", () => {
    expect(occursInWeek({ day: 1, recur: "weekly", anchor_week: null }, NEXT)).toBe(true);
    expect(occursInWeek({ day: 1, recur: "biweekly", anchor_week: null }, NEXT)).toBe(true);
    expect(occursInWeek({ day: 1, recur: "once", anchor_week: null }, NEXT)).toBe(true);
  });

  it("every other week counts from the anchor", () => {
    const b = { day: 1, recur: "biweekly" as const, anchor_week: WEEK };
    expect(occursInWeek(b, WEEK)).toBe(true);
    expect(occursInWeek(b, NEXT)).toBe(false);
    expect(occursInWeek(b, addDayKey(WEEK, 14))).toBe(true);
    expect(occursInWeek(b, addDayKey(WEEK, -14))).toBe(false);
  });

  it("one time is its anchor week only", () => {
    const b = { day: 1, recur: "once" as const, anchor_week: WEEK };
    expect(occursInWeek(b, WEEK)).toBe(true);
    expect(occursInWeek(b, NEXT)).toBe(false);
  });

  it("monthly keeps the same nth weekday", () => {
    // Anchor: Tue 2026-10-20 is the third Tuesday of October.
    const b = { day: 1, recur: "monthly" as const, anchor_week: WEEK };
    expect(occursInWeek(b, NEXT)).toBe(false); // Oct 27, the fourth
    expect(occursInWeek(b, "2026-11-16")).toBe(true); // Nov 17, the third
    expect(occursInWeek(b, "2026-11-09")).toBe(false); // Nov 10, the second
  });

  it("anchored blocks outside their week are left out", () => {
    const once = block("once", 2, 600, 660, { recur: "once", anchor_week: WEEK });
    expect(occurrencesForWeek([once], [], NEXT)).toEqual([]);
  });
});

describe("clashesAt", () => {
  const occ = occurrencesForWeek(
    [
      block("group", 1, 450, 570, { title: "Family small group", block_type: "group" }),
      block("drive", 1, 570, 600, { block_type: "travel" }),
      block("work", 1, 600, 660),
    ],
    [],
    WEEK,
  );

  it("names what a spot overlaps, ignoring travel and itself", () => {
    expect(clashesAt(occ, { day: 1, start: 540, end: 600 }).map((o) => o.block.title)).toEqual(["Family small group"]);
    expect(clashesAt(occ, { day: 1, start: 600, end: 660 }, "work")).toEqual([]);
    expect(clashesAt(occ, { day: 2, start: 450, end: 570 })).toEqual([]);
  });

  it("touching edges are not a clash", () => {
    expect(clashesAt(occ, { day: 1, start: 660, end: 720 })).toEqual([]);
  });
});
