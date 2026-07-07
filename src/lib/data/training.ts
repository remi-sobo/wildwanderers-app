import { createClient } from "@/lib/supabase/server";
import { getPlanForClient, type PlanWithWorkouts } from "@/lib/data/plans";

export type MyClient = {
  id: string;
  first_name: string;
  last_name: string;
  goal: string | null;
};

// The clients row for the signed-in client user (RLS: user reads their own).
export async function getMyClient(): Promise<MyClient | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, goal")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as MyClient | null) ?? null;
}

export type MyTraining = {
  client: MyClient | null;
  plan: PlanWithWorkouts | null;
  completedIds: string[];
};

// The signed-in client's active plan and which exercises they have completed.
export async function getMyTraining(): Promise<MyTraining> {
  const client = await getMyClient();
  if (!client) return { client: null, plan: null, completedIds: [] };

  const plan = await getPlanForClient(client.id);

  const supabase = await createClient();
  const { data: comps } = await supabase
    .from("exercise_completions")
    .select("workout_exercise_id")
    .eq("client_id", client.id);

  return {
    client,
    plan,
    completedIds: (comps ?? []).map((c) => c.workout_exercise_id as string),
  };
}

export type MyWorkout = {
  planId: string;
  title: string;
  status: "draft" | "pending_review";
  reviewedAt: string | null;
  createdAt: string;
  exercises: import("@/lib/data/plans").Exercise[];
};

export type MyWorkoutsData = { workouts: MyWorkout[]; completedIds: string[] };

// The signed-in client's own self-directed workouts (one workout per plan),
// newest first, with their completions. RLS scopes every read to the client's
// own lane; a coach draft never appears here.
export async function getMyWorkouts(): Promise<MyWorkoutsData> {
  const client = await getMyClient();
  if (!client) return { workouts: [], completedIds: [] };

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, title, status, coach_approved_at, created_at")
    .eq("client_id", client.id)
    .eq("initiated_by", "client")
    .in("status", ["draft", "pending_review"])
    .order("created_at", { ascending: false });
  if (!plans || plans.length === 0) return { workouts: [], completedIds: [] };

  const planIds = plans.map((p) => p.id as string);
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, plan_id")
    .in("plan_id", planIds);
  const workoutIds = (workouts ?? []).map((w) => w.id as string);

  const { data: exercises } = workoutIds.length
    ? await supabase
        .from("workout_exercises")
        .select(
          "id, workout_id, library_item_id, kind, title, instructions, sets, reps, rest_seconds, load, media_url, sort_order, is_optional",
        )
        .in("workout_id", workoutIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const workoutByPlan = new Map<string, string>();
  for (const w of workouts ?? []) workoutByPlan.set(w.plan_id as string, w.id as string);
  const exByWorkout = new Map<string, import("@/lib/data/plans").Exercise[]>();
  for (const ex of (exercises ?? []) as import("@/lib/data/plans").Exercise[]) {
    const arr = exByWorkout.get(ex.workout_id) ?? [];
    arr.push(ex);
    exByWorkout.set(ex.workout_id, arr);
  }

  const { data: comps } = workoutIds.length
    ? await supabase
        .from("exercise_completions")
        .select("workout_exercise_id")
        .eq("client_id", client.id)
    : { data: [] };

  return {
    workouts: plans.map((p) => ({
      planId: p.id as string,
      title: p.title as string,
      status: p.status as "draft" | "pending_review",
      reviewedAt: (p.coach_approved_at as string | null) ?? null,
      createdAt: p.created_at as string,
      exercises: exByWorkout.get(workoutByPlan.get(p.id as string) ?? "") ?? [],
    })),
    completedIds: (comps ?? []).map((c) => c.workout_exercise_id as string),
  };
}

// The first workout with an incomplete required exercise, else the first one.
export function currentWorkoutIndex(
  plan: PlanWithWorkouts,
  completed: Set<string>,
): number {
  const idx = plan.workouts.findIndex((w) =>
    w.exercises.some((e) => !e.is_optional && !completed.has(e.id)),
  );
  return idx === -1 ? 0 : idx;
}
