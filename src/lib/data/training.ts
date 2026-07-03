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
