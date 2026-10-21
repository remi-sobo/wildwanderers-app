import { describe, expect, it } from "vitest";
import type { NavItem, NavSection } from "./nav";
import { activeHref, mobileNavForRole, ownerHqMobileNav, ownerHqSections, sectionsForRole } from "./nav";
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
      ["/week", "Week"],
      ["/business", "Business"],
      ["/messages", "Messages"],
    ]);
    expect(m.more).toEqual([]);
  });

  it("desktop: the same four, then Shortcuts to existing routes", () => {
    expect(sections(ownerHqSections())).toEqual([
      [null, [
        ["/today", "Today", null],
        ["/week", "Week", null],
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

describe("advisor and unknown roles never fall through", () => {
  it("advisor gets only Work, Calls and Settings", () => {
    expect(sections(sectionsForRole("advisor"))).toEqual([
      ["Advisor", [["/advisor", "Work", null], ["/advisor/calls", "Calls", null]]],
      [null, [["/settings", "Settings", null]]],
    ]);
    const m = mobileNavForRole("advisor");
    expect(m.tabs.map((i) => i.href)).toEqual(["/advisor", "/advisor/calls", "/settings"]);
    expect(m.more).toEqual([]);
  });

  it("advisor lands on the advisor workspace, an unknown role on no access", () => {
    expect(surfaceForRole("advisor")).toBe("/advisor");
    expect(surfaceForRole("advisor", { ownerHq: true })).toBe("/advisor");
    expect(surfaceForRole(undefined)).toBe("/no-access");
    expect(surfaceForRole("nope" as never)).toBe("/no-access");
  });

  it("an unknown role sees only Settings, never the client menu", () => {
    expect(sections(sectionsForRole("nope" as never))).toEqual([[null, [["/settings", "Settings", null]]]]);
    expect(mobileNavForRole("nope" as never)).toEqual({ tabs: [expect.objectContaining({ href: "/settings" })], more: [] });
  });
});

describe("activeHref", () => {
  const items = (hrefs: string[]) => hrefs.map((href) => ({ href, label: href, icon: (() => null) as never }));

  it("picks the longest href the path sits under", () => {
    expect(activeHref(items(["/home", "/homework"]), "/homework")).toBe("/homework");
    expect(activeHref(items(["/home", "/homework"]), "/home")).toBe("/home");
    expect(activeHref(items(["/advisor", "/advisor/calls"]), "/advisor/calls/abc")).toBe("/advisor/calls");
    expect(activeHref(items(["/advisor", "/advisor/calls"]), "/advisor")).toBe("/advisor");
    expect(activeHref(items(["/business"]), "/business/pipeline")).toBe("/business");
  });

  it("needs a slash boundary and returns null off the menu", () => {
    expect(activeHref(items(["/program"]), "/programs")).toBeNull();
    expect(activeHref(items(["/program"]), "/settings")).toBeNull();
  });
});
