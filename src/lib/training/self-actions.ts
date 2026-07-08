"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyClient } from "@/lib/data/training";
import { auditLog } from "@/lib/audit/log";

export type SelfExerciseInput = {
  title: string;
  kind: string;
  sets: string;
  reps: string;
  load: string;
  libraryItemId: string | null;
  mediaUrl: string;
};

export type SelfDayInput = {
  title: string;
  exercises: SelfExerciseInput[];
};

export type CreateSelfWorkoutResult = { error: string | null };

// The signed-in client saves their own workout or short plan, up to seven
// days, built by hand from the movement library. No AI anywhere in this
// path. RLS holds it to their own lane: initiated_by 'client', resting
// status, never their active plan.
export async function createSelfPlan(
  title: string,
  days: SelfDayInput[],
): Promise<CreateSelfWorkoutResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const cleanTitle = title.trim();
  if (!cleanTitle) return { error: "Give it a name." };
  const cleanDays = days
    .map((d) => ({ ...d, exercises: d.exercises.filter((e) => e.title.trim()) }))
    .filter((d) => d.exercises.length > 0);
  if (cleanDays.length === 0) return { error: "Add at least one movement." };
  if (cleanDays.length > 7) return { error: "Up to seven days fits here. For more, talk with your coach." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_self_plan_atomic", {
    p_title: cleanTitle,
    p_workouts: cleanDays.map((d, di) => ({
      day_number: di + 1,
      title: d.title.trim() || (cleanDays.length > 1 ? `Day ${di + 1}` : cleanTitle),
      exercises: d.exercises.map((e, i) => ({
        title: e.title.trim(),
        kind: e.kind,
        sets: e.sets,
        reps: e.reps,
        load: e.load,
        media_url: e.mediaUrl,
        library_item_id: e.libraryItemId,
        sort_order: i,
      })),
    })),
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "self_workout.create",
    entityTable: "training_plans",
    entityId: client.id,
    metadata: {
      days: cleanDays.length,
      exercises: cleanDays.reduce((n, d) => n + d.exercises.length, 0),
    },
  });

  revalidatePath("/training");
  redirect("/training");
}

// Ask Gabe to look at one of your own workouts. Optional, never required:
// the workout is yours to do either way.
export async function sendSelfWorkoutToCoach(planId: string): Promise<void> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return;

  const supabase = await createClient();
  // RLS: only the client's own client-initiated, resting plans can change.
  await supabase
    .from("training_plans")
    .update({ status: "pending_review", updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("initiated_by", "client");

  revalidatePath("/training");
}

// Remove one of your own workouts. RLS keeps this to the client's own
// self-directed, resting plans; a coach plan can never be touched here.
export async function deleteSelfWorkout(planId: string): Promise<void> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return;

  const supabase = await createClient();
  await supabase
    .from("training_plans")
    .delete()
    .eq("id", planId)
    .eq("initiated_by", "client");

  revalidatePath("/training");
}
