import { createClient } from "@/lib/supabase/server";

export type ExerciseKind =
  | "strength"
  | "cardio"
  | "mobility"
  | "warmup"
  | "cooldown"
  | "skill";

export type Exercise = {
  id: string;
  workout_id: string;
  kind: ExerciseKind;
  title: string;
  instructions: string | null;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  load: string | null;
  media_url: string | null;
  sort_order: number;
  is_optional: boolean;
};

export type Workout = {
  id: string;
  plan_id: string;
  day_number: number;
  week_number: number;
  title: string | null;
  notes: string | null;
  exercises: Exercise[];
};

export type Plan = {
  id: string;
  client_id: string;
  title: string;
  goal: string | null;
  status: "draft" | "active" | "completed" | "archived";
  start_date: string | null;
  end_date: string | null;
  duration_weeks: number | null;
  notes: string | null;
};

export type PlanWithWorkouts = Plan & { workouts: Workout[] };

// The client's active plan (falls back to their most recent plan), with its
// workouts and exercises nested and ordered.
export async function getPlanForClient(
  clientId: string,
): Promise<PlanWithWorkouts | null> {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, client_id, title, goal, status, start_date, end_date, duration_weeks, notes")
    .eq("client_id", clientId)
    .order("status", { ascending: true }) // 'active' sorts before others alphabetically enough; refine below
    .order("created_at", { ascending: false });

  if (!plans || plans.length === 0) return null;
  const plan =
    (plans.find((p) => p.status === "active") as Plan | undefined) ??
    (plans[0] as Plan);

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, plan_id, day_number, week_number, title, notes")
    .eq("plan_id", plan.id)
    .order("day_number", { ascending: true });

  const workoutIds = (workouts ?? []).map((w) => w.id as string);
  const { data: exercises } = workoutIds.length
    ? await supabase
        .from("workout_exercises")
        .select(
          "id, workout_id, kind, title, instructions, sets, reps, rest_seconds, load, media_url, sort_order, is_optional",
        )
        .in("workout_id", workoutIds)
        .order("sort_order", { ascending: true })
    : { data: [] as Exercise[] };

  const byWorkout = new Map<string, Exercise[]>();
  for (const ex of (exercises ?? []) as Exercise[]) {
    const arr = byWorkout.get(ex.workout_id) ?? [];
    arr.push(ex);
    byWorkout.set(ex.workout_id, arr);
  }

  return {
    ...plan,
    workouts: ((workouts ?? []) as Omit<Workout, "exercises">[]).map((w) => ({
      ...w,
      exercises: byWorkout.get(w.id) ?? [],
    })),
  };
}
