import { createClient } from "@/lib/supabase/server";
import type { ExerciseKind } from "@/lib/data/plans";

export type LibraryItem = {
  id: string;
  title: string;
  kind: ExerciseKind;
  muscle_group: string | null;
  equipment: string | null;
  media_url: string | null;
  default_sets: number | null;
  default_reps: string | null;
  cues: string | null;
};

// The org's active exercise library, for the plan builder's picker. RLS scopes
// it to the org.
export async function getExerciseLibrary(): Promise<LibraryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_library")
    .select("id, title, kind, muscle_group, equipment, media_url, default_sets, default_reps, cues")
    .eq("is_active", true)
    .order("title", { ascending: true });
  return (data as LibraryItem[] | null) ?? [];
}
