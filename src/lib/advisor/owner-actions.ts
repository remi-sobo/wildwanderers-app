"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/get-profile";
import type { AdvisorShareKey } from "@/lib/data/advisor-owner";

// The owner's advisor controls (specs/advisor.md). Owner only; every write
// but creating the advisor's login goes through the owner's own session,
// so RLS backs it. The login itself needs the server key, the same as
// inviting a coach.

export type AdvisorResult = { error: string | null };

const SAVE_FAILED = "That did not save. Try again.";
const SHARE_KEYS: AdvisorShareKey[] = ["goals", "five", "tasks", "schedule", "numbers"];

async function ownerContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "owner" || !session.profile.org_id) return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/tasks");
}

// Creates the advisor's login with the advisor role and no org, then links
// it to this org. They set a password from "Forgot password" on sign-in.
// An email that already has an account is refused, so no existing user
// is ever converted.
export async function inviteAdvisor(input: { name: string; email: string }): Promise<AdvisorResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can invite an advisor." };
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email) return { error: "A name and email are needed." };
  if (name.length > 120) return { error: "Use a shorter name." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Inviting an advisor needs the server key. Add SUPABASE_SERVICE_ROLE_KEY in the deployment." };
  }

  const [first, ...rest] = name.split(/\s+/);
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { first_name: first, last_name: rest.join(" ") },
  });
  if (cErr || !created.user) {
    return { error: "We could not create that login. The email may already have an account." };
  }

  // The signup trigger made a client profile with no org. An advisor keeps
  // no org: access comes only from the relationship below.
  const { error: roleErr } = await admin
    .from("profiles")
    .update({ role: "advisor", org_id: null, first_name: first, last_name: rest.join(" ") })
    .eq("id", created.user.id);
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Setting up that login failed. Try again." };
  }

  const supabase = await createClient();
  const { error: relErr } = await supabase.from("advisor_relationships").insert({
    advisor_id: created.user.id,
    org_id: ctx.orgId,
    advisor_name: name,
    created_by: ctx.userId,
  });
  if (relErr) {
    // Without the link the login reaches nothing; remove it so a retry
    // with the same email works.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Linking that login failed. Try again." };
  }

  refresh();
  return { error: null };
}

export async function setAdvisorActive(relationshipId: string, active: boolean): Promise<AdvisorResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can change advisor access." };
  const supabase = await createClient();
  const { error } = await supabase.from("advisor_relationships").update({ active }).eq("id", relationshipId);
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

export async function setAdvisorShare(key: AdvisorShareKey, enabled: boolean): Promise<AdvisorResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can change what is shared." };
  if (!SHARE_KEYS.includes(key)) return { error: SAVE_FAILED };
  const supabase = await createClient();
  const { error } = await supabase
    .from("advisor_shares")
    .upsert({ org_id: ctx.orgId, key, enabled, updated_at: new Date().toISOString() }, { onConflict: "org_id,key" });
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

// A suggestion becomes an ordinary task only when the owner accepts it.
export async function acceptSuggestion(taskId: string): Promise<AdvisorResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can accept a suggestion." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_tasks")
    .update({ kind: "task", updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("kind", "suggestion")
    .select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh();
  revalidatePath("/today");
  return { error: null };
}

export async function declineSuggestion(taskId: string): Promise<AdvisorResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can set a suggestion aside." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_tasks")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("kind", "suggestion")
    .select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

// Sharing a task lets the advisor see it while the tasks share is on. A
// task linked to a client, lead, customer or the kids program still
// reaches them only as "A client task" with no details.
export async function setTaskSharedWithAdvisor(taskId: string, shared: boolean): Promise<AdvisorResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "Only the owner can share a task." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_tasks")
    .update({ shared_with_advisor: shared, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}
