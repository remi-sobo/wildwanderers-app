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

export type SavePlanResult = { error: string | null };

// The builder's workouts, mapped for the atomic RPCs.
function toRpcWorkouts(draft: PlanDraft) {
  return draft.workouts
    .filter((w) => w.exercises.length > 0)
    .map((w) => ({
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
}

// Saves the builder's plan, as a new draft or over an existing resting one,
// and activates it only when asked. Only owner/coach may call it, and RLS
// still governs every write; activating stamps who approved and when.
export async function savePlan(
  clientId: string,
  draft: PlanDraft,
  opts: { planId: string | null; activate: boolean },
): Promise<SavePlanResult> {
  await requireOwnerOrCoach();

  if (!draft.title.trim()) return { error: "Give the plan a title." };
  const p_workouts = toRpcWorkouts(draft);
  if (p_workouts.length === 0) {
    return { error: "Add at least one workout with an exercise." };
  }

  const supabase = await createClient();

  const p_plan = {
    client_id: clientId,
    title: draft.title.trim(),
    goal: draft.goal.trim() || null,
    duration_weeks: draft.durationWeeks || null,
  };

  let planId = opts.planId;
  if (planId) {
    const { error } = await supabase.rpc("update_plan_atomic", {
      p_plan_id: planId,
      p_plan,
      p_workouts,
    });
    if (error) return { error: "We could not save the draft. Try again in a moment." };
  } else {
    const { data, error } = await supabase.rpc("create_plan_atomic", { p_plan, p_workouts });
    if (error || !data?.plan_id) {
      return { error: "We could not save the plan. Try again in a moment." };
    }
    planId = data.plan_id as string;
  }

  if (opts.activate) {
    const { error: activateError } = await supabase.rpc("activate_plan_atomic", {
      p_plan_id: planId,
    });
    if (activateError) {
      return { error: "The plan was saved as a draft but could not be activated." };
    }
  }

  revalidatePath(`/program/clients/${clientId}`);
  redirect(`/program/clients/${clientId}`);
}

// Activates a resting draft straight from the drafts list. The RPC archives
// any currently active plan and stamps the approval.
export async function activateDraft(clientId: string, planId: string): Promise<void> {
  await requireOwnerOrCoach();
  const supabase = await createClient();
  await supabase.rpc("activate_plan_atomic", { p_plan_id: planId });
  revalidatePath(`/program/clients/${clientId}`);
}

// Discards a resting draft. The status filter keeps this away from anything
// live, and the initiated_by filter keeps the coach's hands off a client's
// own workout; that one is the client's to keep or delete.
export async function discardDraft(clientId: string, planId: string): Promise<void> {
  await requireOwnerOrCoach();
  const supabase = await createClient();
  await supabase
    .from("training_plans")
    .delete()
    .eq("id", planId)
    .neq("initiated_by", "client")
    .in("status", ["draft", "pending_review"]);
  revalidatePath(`/program/clients/${clientId}`);
}

// Marks a client-sent workout as looked at: stamps the review and sets it
// back to draft, so it leaves the coach's list and the client sees the nod.
// Never an activation; a client's own workout is never their plan.
export async function markSelfWorkoutReviewed(
  clientId: string,
  planId: string,
): Promise<void> {
  const { userId } = await requireOwnerOrCoach();
  const supabase = await createClient();
  await supabase
    .from("training_plans")
    .update({
      status: "draft",
      coach_approved_at: new Date().toISOString(),
      coach_approved_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("initiated_by", "client")
    .eq("status", "pending_review");
  revalidatePath(`/program/clients/${clientId}`);
  revalidatePath("/training");
}

// --- Sessions ---

export type ScheduleSessionState = { error: string | null; ok: boolean };

export async function scheduleSession(
  _prev: ScheduleSessionState,
  formData: FormData,
): Promise<ScheduleSessionState> {
  const { profile, userId } = await requireOwnerOrCoach();
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "training");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!title) return { error: "Give the session a title.", ok: false };
  if (!date || !time) return { error: "Pick a date and time.", ok: false };

  const startAt = new Date(`${date}T${time}`);
  if (Number.isNaN(startAt.getTime())) {
    return { error: "That date and time did not read. Try again.", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    org_id: profile.org_id,
    coach_id: userId,
    client_id: clientId,
    title,
    kind,
    start_at: startAt.toISOString(),
    notes: notes || null,
    created_by: userId,
  });

  if (error) return { error: "We could not schedule that session. Try again.", ok: false };

  revalidatePath(`/program/clients/${clientId}`);
  return { error: null, ok: true };
}
