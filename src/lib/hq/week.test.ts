import { describe, expect, it } from "vitest";
import { addDays, focusCandidates, stillOpen, suggestFive, togglePick } from "./week";

const t = (id: string, over: Partial<{ status: string; kind: string; pin_today: boolean; due_date: string | null; priority: string }> = {}) => ({
  id,
  status: "open",
  kind: "task",
  pin_today: false,
  due_date: null as string | null,
  priority: "medium",
  ...over,
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-28", 6)).toBe("2027-01-03");
    expect(addDays("2026-10-22", -1)).toBe("2026-10-21");
  });
});

describe("suggestFive", () => {
  it("orders overdue, pinned, assigned, due this week, then high undated; caps at five", () => {
    const out = suggestFive(
      [
        t("later", { due_date: "2026-11-30" }),
        t("week-fri", { due_date: "2026-10-23" }),
        t("week-wed", { due_date: "2026-10-21" }),
        t("high", { priority: "high" }),
        t("low-undated"),
        t("assigned", { kind: "assignment" }),
        t("pinned", { pin_today: true }),
        t("overdue", { due_date: "2026-10-15" }),
        t("done", { status: "done", due_date: "2026-10-10" }),
        t("suggestion", { kind: "suggestion", due_date: "2026-10-10" }),
      ],
      "2026-10-21",
      "2026-10-19",
    );
    expect(out.map((x) => x.id)).toEqual(["overdue", "pinned", "assigned", "week-wed", "week-fri"]);
  });

  it("returns fewer than five rather than padding with anything", () => {
    expect(suggestFive([t("later", { due_date: "2026-12-01" }), t("plain")], "2026-10-21", "2026-10-19")).toEqual([]);
  });
});

describe("stillOpen", () => {
  it("offers yesterday's open picks not already picked today", () => {
    const tasks = [t("a"), t("b", { status: "done" }), t("c"), t("gone")];
    expect(stillOpen(["a", "b", "c", "missing"], tasks, ["c"]).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("focusCandidates", () => {
  it("puts the week's five first in their order, then pins, then due", () => {
    const out = focusCandidates(
      [t("undated"), t("due-later", { due_date: "2026-10-30" }), t("due-today", { due_date: "2026-10-21" }), t("pin", { pin_today: true }), t("five-2"), t("five-1"), t("done", { status: "done" })],
      "2026-10-21",
      ["five-1", "five-2"],
    );
    expect(out.map((x) => x.id)).toEqual(["five-1", "five-2", "pin", "due-today", "due-later", "undated"]);
  });
});

describe("togglePick", () => {
  it("adds, removes, and refuses past the cap", () => {
    expect(togglePick(["a"], "b", 3)).toEqual(["a", "b"]);
    expect(togglePick(["a", "b"], "a", 3)).toEqual(["b"]);
    expect(togglePick(["a", "b", "c"], "d", 3)).toBeNull();
  });
});
