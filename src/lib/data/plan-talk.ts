import { createClient } from "@/lib/supabase/server";

export type PlanComment = {
  id: string;
  plan_id: string;
  workout_exercise_id: string | null;
  author_id: string;
  author_role: "owner" | "coach" | "client" | "parent";
  content: string;
  created_at: string;
};

export type PlanSwap = {
  id: string;
  plan_id: string;
  workout_exercise_id: string;
  suggested_by: string;
  suggested_library_item_id: string | null;
  suggested_title: string;
  suggested_sets: number | null;
  suggested_reps: string | null;
  suggested_load: string | null;
  reason: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export type PlanConversation = {
  commentsByPlan: Map<string, PlanComment[]>;
  swapsByPlan: Map<string, PlanSwap[]>;
};

// Comments and swaps for a set of plans, grouped by plan. RLS inherits
// visibility from the plan, so each caller only ever receives conversation
// on plans they can already see.
export async function getPlanConversation(planIds: string[]): Promise<PlanConversation> {
  const commentsByPlan = new Map<string, PlanComment[]>();
  const swapsByPlan = new Map<string, PlanSwap[]>();
  if (planIds.length === 0) return { commentsByPlan, swapsByPlan };

  const supabase = await createClient();
  const [{ data: comments }, { data: swaps }] = await Promise.all([
    supabase
      .from("plan_comments")
      .select("id, plan_id, workout_exercise_id, author_id, author_role, content, created_at")
      .in("plan_id", planIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("plan_swaps")
      .select(
        "id, plan_id, workout_exercise_id, suggested_by, suggested_library_item_id, suggested_title, suggested_sets, suggested_reps, suggested_load, reason, status, created_at",
      )
      .in("plan_id", planIds)
      .order("created_at", { ascending: false }),
  ]);

  for (const c of (comments ?? []) as PlanComment[]) {
    const arr = commentsByPlan.get(c.plan_id) ?? [];
    arr.push(c);
    commentsByPlan.set(c.plan_id, arr);
  }
  for (const s of (swaps ?? []) as PlanSwap[]) {
    const arr = swapsByPlan.get(s.plan_id) ?? [];
    arr.push(s);
    swapsByPlan.set(s.plan_id, arr);
  }
  return { commentsByPlan, swapsByPlan };
}
