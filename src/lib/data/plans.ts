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
  library_item_id: string | null;
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

export type PlanStatus = "draft" | "pending_review" | "active" | "completed" | "archived";

export type Plan = {
  id: string;
  client_id: string;
  title: string;
  goal: string | null;
  status: PlanStatus;
  start_date: string | null;
  end_date: string | null;
  duration_weeks: number | null;
  notes: string | null;
};

export type PlanWithWorkouts = Plan & { workouts: Workout[] };

// The client's active plan (falls back to their most recent finished plan),
// with its workouts and exercises nested and ordered. Never a resting draft:
// a draft belongs to the coach's review surface until it is activated, so it
// is excluded here as well as by RLS.
export async function getPlanForClient(
  clientId: string,
): Promise<PlanWithWorkouts | null> {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, client_id, title, goal, status, start_date, end_date, duration_weeks, notes")
    .eq("client_id", clientId)
    .in("status", ["active", "completed", "archived"])
    .order("created_at", { ascending: false });

  if (!plans || plans.length === 0) return null;
  const plan =
    (plans.find((p) => p.status === "active") as Plan | undefined) ??
    (plans[0] as Plan);

  return { ...plan, workouts: await loadWorkoutTree(supabase, plan.id) };
}

// The nested, ordered workouts-and-exercises tree for one plan.
async function loadWorkoutTree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
): Promise<Workout[]> {
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, plan_id, day_number, week_number, title, notes")
    .eq("plan_id", planId)
    .order("day_number", { ascending: true });

  const workoutIds = (workouts ?? []).map((w) => w.id as string);
  const { data: exercises } = workoutIds.length
    ? await supabase
        .from("workout_exercises")
        .select(
          "id, workout_id, library_item_id, kind, title, instructions, sets, reps, rest_seconds, load, media_url, sort_order, is_optional",
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

  return ((workouts ?? []) as Omit<Workout, "exercises">[]).map((w) => ({
    ...w,
    exercises: byWorkout.get(w.id) ?? [],
  }));
}

export type PlanWithDraftMeta = PlanWithWorkouts & {
  ai_generated: boolean;
  origin_prompt: string | null;
};

// One plan by id with its tree and draft metadata, for the builder's review
// mode. RLS decides who can load it: staff in the org, never a client on a
// resting draft.
export async function getPlanWithWorkoutsById(
  planId: string,
): Promise<PlanWithDraftMeta | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("training_plans")
    .select(
      "id, client_id, title, goal, status, start_date, end_date, duration_weeks, notes, ai_generated, origin_prompt",
    )
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return null;

  return {
    ...(plan as Plan & { ai_generated: boolean; origin_prompt: string | null }),
    workouts: await loadWorkoutTree(supabase, plan.id as string),
  };
}

export type DraftPlanSummary = {
  id: string;
  title: string;
  status: PlanStatus;
  ai_generated: boolean;
  origin_prompt: string | null;
  created_at: string;
};

// The resting drafts for one client, newest first, for the coach's review
// list. Staff RLS scopes it; a client gets zero rows.
export async function getDraftPlansForClient(
  clientId: string,
): Promise<DraftPlanSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_plans")
    .select("id, title, status, ai_generated, origin_prompt, created_at")
    .eq("client_id", clientId)
    .in("status", ["draft", "pending_review"])
    .order("created_at", { ascending: false });
  return (data as DraftPlanSummary[] | null) ?? [];
}
