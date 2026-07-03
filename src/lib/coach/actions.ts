"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";

export type AddClientState = { error: string | null };

// Creates a client record, and optionally an auth login so the client can sign
// in. The login uses the service role key (admin), so it needs
// SUPABASE_SERVICE_ROLE_KEY set on the server.
export async function addClient(
  _prev: AddClientState,
  formData: FormData,
): Promise<AddClientState> {
  const { profile } = await requireOwnerOrCoach();
  const orgId = profile.org_id;
  if (!orgId) return { error: "Your account is not attached to an organization yet." };

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!firstName) return { error: "Give your client a first name." };
  if (email && password && password.length < 8) {
    return { error: "The temporary password needs at least 8 characters." };
  }

  const supabase = await createClient();
  let userId: string | null = null;

  if (email) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return {
        error:
          "Inviting a login needs the server key. Add SUPABASE_SERVICE_ROLE_KEY, or add the client without an email for now.",
      };
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error || !data.user) {
      return { error: "We could not create that login. Check the email and try again." };
    }
    userId = data.user.id;

    // The signup trigger created a profile with role client and no org. Attach
    // it to this org (admin bypasses RLS for this one server-side step).
    await admin
      .from("profiles")
      .update({ org_id: orgId, role: "client", first_name: firstName, last_name: lastName })
      .eq("id", userId);
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .insert({
      org_id: orgId,
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      goal: goal || null,
      status: "active",
    })
    .select("id")
    .single();

  if (clientError || !clientRow) {
    return { error: "We could not add the client. Try again in a moment." };
  }

  revalidatePath("/program");
  redirect(`/program/clients/${clientRow.id}`);
}

// --- Plan builder ---

export type PlanDraft = {
  title: string;
  goal: string;
  durationWeeks: string;
  workouts: {
    dayNumber: number;
    weekNumber: number;
    title: string;
    exercises: {
      title: string;
      kind: string;
      sets: string;
      reps: string;
      rest_seconds: string;
      load: string;
      instructions: string;
      is_optional: boolean;
      library_item_id: string | null;
      media_url: string;
    }[];
  }[];
};

export type CreatePlanResult = { error: string | null };

// Builds a whole plan in one transaction via create_plan_atomic, then activates
// it. Only owner/coach may call it, and RLS still governs every write.
export async function createAndActivatePlan(
  clientId: string,
  draft: PlanDraft,
): Promise<CreatePlanResult> {
  await requireOwnerOrCoach();

  if (!draft.title.trim()) return { error: "Give the plan a title." };
  const workouts = draft.workouts.filter((w) => w.exercises.length > 0);
  if (workouts.length === 0) {
    return { error: "Add at least one workout with an exercise." };
  }

  const supabase = await createClient();

  const p_plan = {
    client_id: clientId,
    title: draft.title.trim(),
    goal: draft.goal.trim() || null,
    duration_weeks: draft.durationWeeks || null,
  };
  const p_workouts = workouts.map((w) => ({
    day_number: w.dayNumber,
    week_number: w.weekNumber,
    title: w.title.trim() || null,
    exercises: w.exercises.map((e, i) => ({
      title: e.title.trim(),
      kind: e.kind,
      sets: e.sets,
      reps: e.reps,
      rest_seconds: e.rest_seconds,
      load: e.load,
      instructions: e.instructions,
      sort_order: i,
      is_optional: e.is_optional,
      library_item_id: e.library_item_id,
      media_url: e.media_url,
    })),
  }));

  const { data, error } = await supabase.rpc("create_plan_atomic", { p_plan, p_workouts });
  if (error || !data?.plan_id) {
    return { error: "We could not save the plan. Try again in a moment." };
  }

  const { error: activateError } = await supabase.rpc("activate_plan_atomic", {
    p_plan_id: data.plan_id,
  });
  if (activateError) {
    return { error: "The plan was saved as a draft but could not be activated." };
  }

  revalidatePath(`/program/clients/${clientId}`);
  redirect(`/program/clients/${clientId}`);
}
