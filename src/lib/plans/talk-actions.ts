"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { auditLog } from "@/lib/audit/log";

export type TalkResult = { error: string | null };

// Adds a comment on a plan (or one exercise of it). Any participant the
// plan's RLS admits: staff on the org's plans, a client on their own.
export async function addPlanComment(
  planId: string,
  content: string,
  opts?: { exerciseId?: string | null; revalidate?: string },
): Promise<TalkResult> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "Write something first." };

  const session = await getSessionProfile();
  if (!session?.profile) return { error: "You are signed out." };

  const supabase = await createClient();
  const { error } = await supabase.from("plan_comments").insert({
    org_id: session.profile.org_id,
    plan_id: planId,
    workout_exercise_id: opts?.exerciseId ?? null,
    author_id: session.userId,
    author_role: session.profile.role,
    content: trimmed,
  });
  if (error) return { error: "That did not save. Try again." };

  revalidatePath(opts?.revalidate ?? "/training");
  return { error: null };
}

// Removes the caller's own comment. RLS holds it to the author.
export async function deletePlanComment(
  commentId: string,
  revalidate: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("plan_comments").delete().eq("id", commentId);
  revalidatePath(revalidate);
}

export type SwapInput = {
  libraryItemId: string | null;
  title: string;
  sets: string;
  reps: string;
  load: string;
  reason: string;
};

// The coach suggests a replacement for one exercise. The client answers on
// Training; nothing changes until they accept.
export async function suggestSwap(
  planId: string,
  exerciseId: string,
  input: SwapInput,
  revalidate: string,
): Promise<TalkResult> {
  const { profile } = await requireOwnerOrCoach();
  const session = await getSessionProfile();
  if (!input.title.trim()) return { error: "Pick or name the movement to suggest." };

  const supabase = await createClient();
  const { error } = await supabase.from("plan_swaps").insert({
    org_id: profile.org_id,
    plan_id: planId,
    workout_exercise_id: exerciseId,
    suggested_by: session!.userId,
    suggested_library_item_id: input.libraryItemId,
    suggested_title: input.title.trim(),
    suggested_sets: input.sets ? Number(input.sets) : null,
    suggested_reps: input.reps.trim() || null,
    suggested_load: input.load.trim() || null,
    reason: input.reason.trim() || null,
  });
  if (error) return { error: "That did not save. Try again." };

  revalidatePath(revalidate);
  return { error: null };
}

// The coach takes back their own unanswered suggestion.
export async function withdrawSwap(swapId: string, revalidate: string): Promise<void> {
  await requireOwnerOrCoach();
  const supabase = await createClient();
  await supabase.from("plan_swaps").delete().eq("id", swapId).eq("status", "pending");
  revalidatePath(revalidate);
}

// The client answers a suggestion. Acceptance rewrites exactly the one
// agreed exercise row, through the guarded definer RPC, audit-logged.
export async function respondSwap(swapId: string, accept: boolean): Promise<TalkResult> {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "client") {
    return { error: "You are signed out." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_plan_swap", {
    p_swap_id: swapId,
    p_accept: accept,
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: accept ? "plan_swap.accept" : "plan_swap.decline",
    entityTable: "plan_swaps",
    entityId: swapId,
    metadata: {},
  });

  revalidatePath("/training");
  return { error: null };
}
