import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "coach" | "client" | "parent";

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
// the family view, everyone else lands on the client home.
export function surfaceForRole(role: Role | undefined): string {
  if (role === "owner" || role === "coach") return "/program";
  if (role === "parent") return "/family";
  return "/home";
}
