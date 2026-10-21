import { createClient } from "@/lib/supabase/server";

// My three and This Week's Five (specs/week.md), the caller's own picks
// only (RLS). A window around now comes back raw; the page keeps the
// viewer's local day and week, the same way Today and Schedule do.

export type DayPick = { on_date: string; task_id: string; position: number };
export type WeekPick = { week_start: string; task_id: string; position: number };

export async function getPicks(): Promise<{ days: DayPick[]; weeks: WeekPick[] }> {
  const supabase = await createClient();
  const dayFrom = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekFrom = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [{ data: days }, { data: weeks }] = await Promise.all([
    supabase
      .from("day_focus")
      .select("on_date, task_id, position")
      .gte("on_date", dayFrom)
      .order("position", { ascending: true }),
    supabase
      .from("week_plans")
      .select("week_start, task_id, position")
      .gte("week_start", weekFrom)
      .order("position", { ascending: true }),
  ]);
  return { days: (days ?? []) as DayPick[], weeks: (weeks ?? []) as WeekPick[] };
}
