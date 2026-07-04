import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type Org = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
};

// The signed-in user's organization. RLS lets any member read their own org.
export async function getMyOrg(): Promise<Org | null> {
  const session = await getSessionProfile();
  if (!session?.profile?.org_id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, primary_color, secondary_color")
    .eq("id", session.profile.org_id)
    .maybeSingle();
  return (data as Org | null) ?? null;
}

export type OrgCoach = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
};

// The org's staff (owner and coaches), for the settings roster.
export async function getOrgCoaches(): Promise<OrgCoach[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("role", ["owner", "coach"])
    .order("role", { ascending: true });
  return (data as OrgCoach[] | null) ?? [];
}
