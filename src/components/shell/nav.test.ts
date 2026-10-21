import { describe, expect, it } from "vitest";
import type { NavItem, NavSection } from "./nav";
import { mobileNavForRole, ownerHqMobileNav, ownerHqSections, sectionsForRole } from "./nav";
import { surfaceForRole } from "@/lib/auth/get-profile";

// The regression lock for the classic navigation. These are the menus
// every role has in production today. The owner HQ layout is additive
// and flag-gated, so with the flag off none of this may change.

const flat = (i: NavItem) => [i.href, i.label, i.short ?? null];
const sections = (s: NavSection[]) => s.map((x) => [x.label ?? null, x.items.map(flat)]);

describe("classic desktop sections", () => {
  it("owner", () => {
    expect(sections(sectionsForRole("owner"))).toEqual([
      ["Surface", [
        ["/program", "Program", null],
        ["/fitness", "Fitness", null],
        ["/boys", "Dads & Kids", "Dads & Kids"],
        ["/business", "Business", null],
        ["/schedule", "Schedule", null],
        ["/tasks", "Tasks", null],
      ]],
      ["Content", [
        ["/library", "Trailhead Library", "Library"],
        ["/alongside", "Alongside", null],
      ]],
      ["Workspace", [
        ["/messages", "Messages", null],
        ["/settings", "Settings", null],
      ]],
    ]);
  });

  it("coach", () => {
    expect(sections(sectionsForRole("coach"))).toEqual([
      ["Surface", [
        ["/program", "Program", null],
        ["/fitness", "Fitness", null],
        ["/boys", "Dads & Kids", "Dads & Kids"],
        ["/schedule", "Schedule", null],
        ["/tasks", "Tasks", null],
      ]],
      ["Content", [["/alongside", "Alongside", null]]],
      ["Workspace", [
        ["/messages", "Messages", null],
        ["/settings", "Settings", null],
      ]],
    ]);
  });

  it("client", () => {
    expect(sections(sectionsForRole("client"))).toEqual([
      ["Menu", [
        ["/home", "Home", null],
        ["/training", "Training", null],
        ["/homework", "Homework", null],
        ["/log", "Log", null],
        ["/progress", "Progress", null],
        ["/from-your-coach", "Alongside", null],
        ["/trailhead", "Trailhead Library", "Library"],
      ]],
      ["Workspace", [
        ["/messages", "Messages", null],
        ["/settings", "Settings", null],
      ]],
    ]);
  });

  it("parent", () => {
    expect(sections(sectionsForRole("parent"))).toEqual([
      ["Menu", [
        ["/family", "My family", "Family"],
        ["/from-your-coach", "Alongside", null],
        ["/trailhead", "Trailhead Library", "Library"],
        ["/messages", "Messages", null],
      ]],
      [null, [["/settings", "Settings", null]]],
    ]);
  });
});

describe("classic mobile tabs and More", () => {
  const split = (r: Parameters<typeof mobileNavForRole>[0]) => {
    const m = mobileNavForRole(r);
    return { tabs: m.tabs.map((i) => i.href), more: m.more.map((i) => i.href) };
  };

  it("owner", () => {
    expect(split("owner")).toEqual({
      tabs: ["/program", "/fitness", "/business", "/messages"],
      more: ["/schedule", "/tasks", "/boys", "/library", "/alongside", "/settings"],
    });
  });

  it("coach", () => {
    expect(split("coach")).toEqual({
      tabs: ["/program", "/fitness", "/boys", "/messages"],
      more: ["/schedule", "/tasks", "/alongside", "/settings"],
    });
  });

  it("client", () => {
    expect(split("client")).toEqual({
      tabs: ["/home", "/training", "/log", "/messages"],
      more: ["/homework", "/progress", "/from-your-coach", "/trailhead", "/settings"],
    });
  });

  it("parent", () => {
    expect(split("parent")).toEqual({
      tabs: ["/family", "/messages", "/from-your-coach", "/trailhead"],
      more: ["/settings"],
    });
  });
});

describe("owner HQ layout", () => {
  it("phone: Today, Week, Business, Messages and no More sheet", () => {
    const m = ownerHqMobileNav();
    expect(m.tabs.map((i) => [i.href, i.label])).toEqual([
      ["/today", "Today"],
      ["/schedule", "Week"],
      ["/business", "Business"],
      ["/messages", "Messages"],
    ]);
    expect(m.more).toEqual([]);
  });

  it("desktop: the same four, then Shortcuts to existing routes", () => {
    expect(sections(ownerHqSections())).toEqual([
      [null, [
        ["/today", "Today", null],
        ["/schedule", "Week", null],
        ["/business", "Business", null],
        ["/messages", "Messages", null],
      ]],
      ["Shortcuts", [
        ["/program", "Clients", null],
        ["/boys", "Dads & Kids", null],
        ["/business/popup", "Pop-up days", null],
        ["/tasks", "Tasks", null],
        ["/schedule", "Schedule", null],
        ["/business/pipeline", "Leads", null],
        ["/business/numbers", "Numbers", null],
      ]],
    ]);
  });
});

describe("landing", () => {
  it("only a flagged owner lands on Today", () => {
    expect(surfaceForRole("owner", { ownerHq: true })).toBe("/today");
    expect(surfaceForRole("owner", { ownerHq: false })).toBe("/program");
    expect(surfaceForRole("owner")).toBe("/program");
    expect(surfaceForRole("coach", { ownerHq: true })).toBe("/program");
    expect(surfaceForRole("parent", { ownerHq: true })).toBe("/family");
    expect(surfaceForRole("client", { ownerHq: true })).toBe("/home");
  });
});
