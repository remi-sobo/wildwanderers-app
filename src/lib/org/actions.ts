"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type OrgResult = { error: string | null };

async function ownerContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "owner") return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// White-label: the owner sets the org's name, brand colors, and logo. These are
// the fields a second coach's org would differ on for resale.
export async function updateOrgBranding(input: {
  name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}): Promise<OrgResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can change branding." };
  if (!input.name.trim()) return { error: "The organization needs a name." };
  if (input.primary_color && !HEX.test(input.primary_color)) return { error: "Primary color should be a hex like #2E4A33." };
  if (input.secondary_color && !HEX.test(input.secondary_color)) return { error: "Secondary color should be a hex like #D98A3A." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name.trim(),
      logo_url: input.logo_url?.trim() || null,
      ...(input.primary_color ? { primary_color: input.primary_color } : {}),
      ...(input.secondary_color ? { secondary_color: input.secondary_color } : {}),
    })
    .eq("id", ctx.orgId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { error: null };
}

// Multi-coach polish: the owner invites a second coach into the org, the first
// step on the road to resale. Needs the server key.
export async function inviteCoach(input: {
  first_name: string;
  last_name: string;
  email: string;
}): Promise<OrgResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can invite a coach." };
  const email = input.email.trim();
  if (!input.first_name.trim() || !email) return { error: "A name and email are needed." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Inviting a coach needs the server key. Add SUPABASE_SERVICE_ROLE_KEY in the deployment." };
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { first_name: input.first_name.trim(), last_name: input.last_name.trim() },
  });
  if (cErr || !created.user) {
    return { error: "We could not create that login. The email may already be in use." };
  }

  await admin
    .from("profiles")
    .update({
      org_id: ctx.orgId,
      role: "coach",
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
    })
    .eq("id", created.user.id);

  revalidatePath("/settings");
  return { error: null };
}
