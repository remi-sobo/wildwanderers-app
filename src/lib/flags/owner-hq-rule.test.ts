import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/auth/get-profile";
import { ownerHqActive, ownerHqMode, ownerHqOffered } from "./owner-hq-rule";

const ROLES: Role[] = ["owner", "coach", "client", "parent"];
const COOKIES = [undefined, "1", "0", "junk"];

describe("ownerHqMode", () => {
  it("is off unless set to on or optin", () => {
    expect(ownerHqMode(undefined)).toBe("off");
    expect(ownerHqMode("")).toBe("off");
    expect(ownerHqMode("true")).toBe("off");
    expect(ownerHqMode("off")).toBe("off");
    expect(ownerHqMode("optin")).toBe("optin");
    expect(ownerHqMode(" ON ")).toBe("on");
  });
});

describe("ownerHqActive", () => {
  it("never applies to coach, client or parent, whatever the env or cookie", () => {
    for (const role of ROLES.filter((r) => r !== "owner")) {
      for (const mode of ["off", "optin", "on"] as const) {
        for (const c of COOKIES) {
          expect(ownerHqActive(role, mode, c)).toBe(false);
          expect(ownerHqOffered(role, mode)).toBe(false);
        }
      }
    }
    expect(ownerHqActive(undefined, "on", "1")).toBe(false);
  });

  it("off: the owner keeps the classic layout even with the cookie set", () => {
    for (const c of COOKIES) expect(ownerHqActive("owner", "off", c)).toBe(false);
    expect(ownerHqOffered("owner", "off")).toBe(false);
  });

  it("optin: only an explicit yes turns it on", () => {
    expect(ownerHqActive("owner", "optin", undefined)).toBe(false);
    expect(ownerHqActive("owner", "optin", "1")).toBe(true);
    expect(ownerHqActive("owner", "optin", "0")).toBe(false);
    expect(ownerHqActive("owner", "optin", "junk")).toBe(false);
    expect(ownerHqOffered("owner", "optin")).toBe(true);
  });

  it("on: on unless the owner switched back", () => {
    expect(ownerHqActive("owner", "on", undefined)).toBe(true);
    expect(ownerHqActive("owner", "on", "1")).toBe(true);
    expect(ownerHqActive("owner", "on", "0")).toBe(false);
    expect(ownerHqOffered("owner", "on")).toBe(true);
  });
});
