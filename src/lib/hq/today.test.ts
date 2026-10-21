import { describe, expect, it } from "vitest";
import { buildAgenda, dueLabel, nextUp, selectTodayTasks, weekdayIndex } from "./today";

const task = (id: string, over: Partial<{ status: string; pin_today: boolean; due_date: string | null }>) => ({
  id,
  status: "open",
  pin_today: false,
  due_date: null,
  ...over,
});

describe("selectTodayTasks", () => {
  it("shows pins, then due and overdue, oldest first; skips done and later", () => {
    const { pinned, due } = selectTodayTasks(
      [
        task("pin", { pin_today: true, due_date: "2026-11-30" }),
        task("today", { due_date: "2026-10-21" }),
        task("late", { due_date: "2026-10-16" }),
        task("later", { due_date: "2026-10-22" }),
        task("undated", {}),
        task("done", { status: "done", due_date: "2026-10-20" }),
        task("cancelled", { status: "cancelled", pin_today: true }),
        task("doing", { status: "in_progress", due_date: "2026-10-21" }),
      ],
      "2026-10-21",
    );
    expect(pinned.map((t) => t.id)).toEqual(["pin"]);
    expect(due.map((t) => t.id)).toEqual(["late", "today", "doing"]);
  });
});

describe("agenda", () => {
  // Wednesday 21 Oct 2026, 9:00 local.
  const now = new Date(2026, 9, 21, 9, 0);
  const block = (id: string, day: number, s: number, e: number, type = "client") => ({
    id,
    day,
    start_min: s,
    end_min: e,
    title: id,
    location: null,
    block_type: type as "client",
    recur: "weekly" as const,
  });

  it("uses Monday as day 0", () => {
    expect(weekdayIndex(now)).toBe(2);
  });

  it("merges today's blocks and today's sessions in time order", () => {
    const agenda = buildAgenda(
      [block("wed-late", 2, 900, 960), block("wed-early", 2, 390, 450), block("thu", 3, 600, 660)],
      [
        { id: "s1", title: "Session", start_at: new Date(2026, 9, 21, 11, 0).toISOString(), end_at: null, location: null },
        { id: "s2", title: "Tomorrow", start_at: new Date(2026, 9, 22, 11, 0).toISOString(), end_at: null, location: null },
      ],
      now,
    );
    expect(agenda.map((i) => i.id)).toEqual(["wed-early", "s1", "wed-late"]);
  });

  it("next up skips what started and travel", () => {
    const agenda = buildAgenda(
      [block("done", 2, 390, 450), block("drive", 2, 560, 600, "travel"), block("next", 2, 600, 720)],
      [],
      now,
    );
    expect(nextUp(agenda, now)?.id).toBe("next");
    expect(nextUp(agenda, new Date(2026, 9, 21, 13, 0))).toBeNull();
  });
});

describe("dueLabel", () => {
  it("labels today and overdue", () => {
    expect(dueLabel("2026-10-21", "2026-10-21")).toEqual({ text: "Due today", overdue: false });
    expect(dueLabel("2026-10-16", "2026-10-21")).toEqual({ text: "Overdue, was Oct 16", overdue: true });
    expect(dueLabel("2026-10-24", "2026-10-21")).toEqual({ text: "Due Oct 24", overdue: false });
  });
});
