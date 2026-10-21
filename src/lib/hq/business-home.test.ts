import { describe, expect, it } from "vitest";
import { mobileNavForRole, sectionsForRole } from "@/components/shell/nav";
import {
  DIRECTORY,
  MODULES,
  QUICK_DEFAULT,
  addTile,
  countDueBy,
  localDayKey,
  moveTileEarlier,
  parseQuickAccess,
  removeTile,
} from "./business-home";

describe("directory", () => {
  it("lists every module exactly once", () => {
    const listed = DIRECTORY.flatMap((g) => g.keys);
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.sort()).toEqual(Object.keys(MODULES).sort());
  });

  it("reaches every destination the classic owner menu had", () => {
    const hrefs = new Set(Object.values(MODULES).map((m) => m.href));
    const classic = [
      ...sectionsForRole("owner").flatMap((s) => s.items),
      ...mobileNavForRole("owner").more,
    ].map((i) => i.href);
    // The classic /business dashboard lives at /business/numbers under HQ.
    for (const href of classic) {
      expect(href === "/business" ? hrefs.has("/business/numbers") : hrefs.has(href)).toBe(true);
    }
  });
});

describe("quick access tiles", () => {
  it("falls back to the defaults on missing or broken storage", () => {
    expect(parseQuickAccess(null)).toEqual(QUICK_DEFAULT);
    expect(parseQuickAccess("not json")).toEqual(QUICK_DEFAULT);
    expect(parseQuickAccess('{"a":1}')).toEqual(QUICK_DEFAULT);
    expect(parseQuickAccess("[]")).toEqual(QUICK_DEFAULT);
    expect(parseQuickAccess('["nope"]')).toEqual(QUICK_DEFAULT);
  });

  it("keeps known keys, drops duplicates, caps at four", () => {
    expect(parseQuickAccess('["tasks","tasks","nope","leads"]')).toEqual(["tasks", "leads"]);
    expect(parseQuickAccess('["tasks","leads","clients","boys","popup"]')).toEqual([
      "tasks",
      "leads",
      "clients",
      "boys",
    ]);
  });

  it("adds, removes and reorders", () => {
    expect(addTile(["tasks"], "leads")).toEqual(["tasks", "leads"]);
    expect(addTile(["tasks"], "tasks")).toEqual(["tasks"]);
    expect(addTile(["clients", "boys", "popup", "leads"], "tasks")).toEqual(["clients", "boys", "popup", "tasks"]);
    expect(removeTile(["clients", "boys"], "clients")).toEqual(["boys"]);
    expect(moveTileEarlier(["clients", "boys", "popup"], "popup")).toEqual(["clients", "popup", "boys"]);
    expect(moveTileEarlier(["clients", "boys"], "clients")).toEqual(["clients", "boys"]);
  });
});

describe("local days", () => {
  it("keys the local calendar day", () => {
    expect(localDayKey(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
  });

  it("counts due on or before today", () => {
    expect(countDueBy(["2026-10-20", "2026-10-21", "2026-10-22"], "2026-10-21")).toBe(2);
    expect(countDueBy([], "2026-10-21")).toBe(0);
  });
});
