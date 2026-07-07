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
// it to the org. Ordered by Gabe's arrangement (sort_order), then title.
export async function getExerciseLibrary(): Promise<LibraryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_library")
    .select("id, title, kind, muscle_group, equipment, media_url, default_sets, default_reps, cues")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  return (data as LibraryItem[] | null) ?? [];
}

// The full movement, active and retired, for the Movements manager. Carries the
// staff-only fields (is_active, sort_order, instructions) the picker omits.
export type ManagedMovement = LibraryItem & {
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
  // How many workout prescriptions point at this movement. When > 0 we retire
  // rather than delete, so plan history keeps its link.
  usage_count: number;
};

const MANAGED_COLUMNS =
  "id, title, kind, muscle_group, equipment, media_url, default_sets, default_reps, cues, instructions, is_active, sort_order";

// Every movement in the org, staff-facing. RLS lets owner and coach read the
// full library (active and retired); a client never reaches this path.
export async function getManagedMovements(): Promise<ManagedMovement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_library")
    .select(MANAGED_COLUMNS)
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  const rows = (data as Omit<ManagedMovement, "usage_count">[] | null) ?? [];
  if (rows.length === 0) return [];

  // One grouped read of how many workout prescriptions reference each movement,
  // so the manager can offer delete only when a movement is truly unused.
  const ids = rows.map((r) => r.id);
  const { data: refs } = await supabase
    .from("workout_exercises")
    .select("library_item_id")
    .in("library_item_id", ids);
  const counts = new Map<string, number>();
  for (const r of (refs as { library_item_id: string | null }[] | null) ?? []) {
    if (r.library_item_id) counts.set(r.library_item_id, (counts.get(r.library_item_id) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, usage_count: counts.get(r.id) ?? 0 }));
}

// A single movement for the edit screen. Returns null if it is not in the
// caller's org (RLS) or does not exist.
export async function getMovement(id: string): Promise<ManagedMovement | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_library")
    .select(MANAGED_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Omit<ManagedMovement, "usage_count">;
  const { count } = await supabase
    .from("workout_exercises")
    .select("id", { count: "exact", head: true })
    .eq("library_item_id", id);
  return { ...row, usage_count: count ?? 0 };
}
