import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// "advisor" is a business advisor to the owner (Remi): never staff, never a
// client. It has its own surface and reaches nothing else; see
// specs/advisor.md. Any role not listed here gets no surface at all.
export type Role = "owner" | "coach" | "client" | "parent" | "advisor";

export type Profile = {
  id: string;
  org_id: string | null;
  role: Role;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

export type SessionProfile = {
  userId: string;
  email: string | null;
  profile: Profile | null;
};

// Resolves the signed-in user and their profile row. Cached per request so
// the layout guards and the surfaces do not each hit the database.
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile | null) ?? null,
  };
});

// Where a role belongs. Owner and coach share the coach shell, a parent gets
// the family view, a client the client home, an advisor the advisor
// workspace. An owner on the owner HQ layout (lib/flags) lands on Today. A
// missing or unknown role never falls through to another role's surface.
export function surfaceForRole(role: Role | undefined, opts?: { ownerHq?: boolean }): string {
  if (role === "owner" && opts?.ownerHq) return "/today";
  if (role === "owner" || role === "coach") return "/program";
  if (role === "parent") return "/family";
  if (role === "client") return "/home";
  if (role === "advisor") return "/advisor";
  return "/no-access";
}
