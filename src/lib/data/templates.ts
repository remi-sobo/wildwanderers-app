import { createClient } from "@/lib/supabase/server";
import type { ExerciseKind } from "@/lib/data/plans";

export type TemplateSummary = {
  id: string;
  title: string;
  goal: string | null;
  duration_weeks: number | null;
  is_active: boolean;
  is_client_visible: boolean;
  created_at: string;
  workout_count: number;
};

export type TemplateExercise = {
  id: string;
  template_workout_id: string;
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

export type TemplateWorkout = {
  id: string;
  day_number: number;
  week_number: number;
  title: string | null;
  notes: string | null;
  exercises: TemplateExercise[];
};

export type TemplateWithWorkouts = {
  id: string;
  title: string;
  goal: string | null;
  duration_weeks: number | null;
  notes: string | null;
  is_active: boolean;
  workouts: TemplateWorkout[];
};

// The org's templates for the manage surface and the start-from picker.
// Staff RLS scopes it; a client gets zero rows.
export async function getPlanTemplates(opts?: {
  activeOnly?: boolean;
}): Promise<TemplateSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("plan_templates")
    .select(
      "id, title, goal, duration_weeks, is_active, is_client_visible, created_at, template_workouts(count)",
    )
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts?.activeOnly) query = query.eq("is_active", true);

  const { data } = await query;
  return ((data ?? []) as unknown as (Omit<TemplateSummary, "workout_count"> & {
    template_workouts: { count: number }[];
  })[]).map((t) => ({
    id: t.id,
    title: t.title,
    goal: t.goal,
    duration_weeks: t.duration_weeks,
    is_active: t.is_active,
    is_client_visible: t.is_client_visible,
    created_at: t.created_at,
    workout_count: t.template_workouts?.[0]?.count ?? 0,
  }));
}

// One template with its ordered tree, for instantiating into a client's draft.
export async function getTemplateWithWorkouts(
  templateId: string,
): Promise<TemplateWithWorkouts | null> {
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("plan_templates")
    .select("id, title, goal, duration_weeks, notes, is_active")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return null;

  const { data: workouts } = await supabase
    .from("template_workouts")
    .select("id, day_number, week_number, title, notes")
    .eq("template_id", templateId)
    .order("day_number", { ascending: true });

  const workoutIds = (workouts ?? []).map((w) => w.id as string);
  const { data: exercises } = workoutIds.length
    ? await supabase
        .from("template_workout_exercises")
        .select(
          "id, template_workout_id, library_item_id, kind, title, instructions, sets, reps, rest_seconds, load, media_url, sort_order, is_optional",
        )
        .in("template_workout_id", workoutIds)
        .order("sort_order", { ascending: true })
    : { data: [] as TemplateExercise[] };

  const byWorkout = new Map<string, TemplateExercise[]>();
  for (const ex of (exercises ?? []) as TemplateExercise[]) {
    const arr = byWorkout.get(ex.template_workout_id) ?? [];
    arr.push(ex);
    byWorkout.set(ex.template_workout_id, arr);
  }

  return {
    ...(template as Omit<TemplateWithWorkouts, "workouts">),
    workouts: ((workouts ?? []) as Omit<TemplateWorkout, "exercises">[]).map((w) => ({
      ...w,
      exercises: byWorkout.get(w.id) ?? [],
    })),
  };
}
