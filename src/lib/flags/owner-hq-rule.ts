// The owner HQ layout flag, as a pure rule so it can be tested without
// a request. The server reader (owner-hq.ts) feeds it the deployment's
// OWNER_HQ setting and the owner's own choice from their cookie.
//
// OWNER_HQ, set per deployment:
//   unset or anything else  off for everyone (the classic layout)
//   "optin"                 the owner can turn it on in Settings
//   "on"                    on for the owner, who can switch back in Settings
//
// Only the owner role is ever affected. The flag changes navigation and
// the owner's landing page; it never changes what anyone can read or
// write, which RLS and the route guards decide on their own.

import type { Role } from "@/lib/auth/get-profile";

export type OwnerHqMode = "off" | "optin" | "on";

export const OWNER_HQ_COOKIE = "ww_owner_hq";

export function ownerHqMode(env: string | undefined): OwnerHqMode {
  const v = env?.trim().toLowerCase();
  return v === "on" || v === "optin" ? v : "off";
}

/** Whether the owner may see the layout toggle in Settings. */
export function ownerHqOffered(role: Role | undefined, mode: OwnerHqMode): boolean {
  return role === "owner" && mode !== "off";
}

/** Whether this request renders the owner HQ layout. */
export function ownerHqActive(
  role: Role | undefined,
  mode: OwnerHqMode,
  cookie: string | undefined,
): boolean {
  if (role !== "owner") return false;
  if (mode === "on") return cookie !== "0";
  if (mode === "optin") return cookie === "1";
  return false;
}
