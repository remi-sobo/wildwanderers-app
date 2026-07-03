import { createClient } from "@/lib/supabase/server";
import type {
  WellnessScore,
  WeightPoint,
  HabitAdherence,
  Measurement,
  ActivityLog,
} from "@/lib/data/wellness";

const KG_PER_LB = 0.45359237;

export type ClientWellness = {
  hasConsent: boolean;
  score: WellnessScore | null;
  weightSeries: WeightPoint[];
  latestMeasurement: Measurement | null;
  habits: HabitAdherence[];
  recentActivity: ActivityLog[];
  hasAnyData: boolean;
};

// A client's wellness picture for the coach. RLS scopes reads to the coach's
// org; the score RPC is guarded to same-org staff. Never fabricates: an empty
// picture reads as "nothing logged yet", not zeros.
export async function getClientWellness(clientId: string): Promise<ClientWellness> {
  const supabase = await createClient();
  const weekAgoDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const [{ data: consent }, scoreRes, { data: meas }, { data: habits }, { data: hlogs }, { data: acts }] =
    await Promise.all([
      supabase
        .from("consents")
        .select("id")
        .eq("client_id", clientId)
        .eq("kind", "health_tracking")
        .limit(1)
        .maybeSingle(),
      supabase.rpc("compute_wellness_score", { p_client_id: clientId }),
      supabase
        .from("measurements")
        .select(
          "id, taken_at, weight_kg, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, body_fat_pct, notes",
        )
        .eq("client_id", clientId)
        .order("taken_at", { ascending: true }),
      supabase
        .from("habits")
        .select("id, title, target_per_week")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("client_id", clientId)
        .gte("logged_on", weekAgoDate),
      supabase
        .from("activity_logs")
        .select("id, logged_at, kind, duration_minutes, estimated_energy_kcal")
        .eq("client_id", clientId)
        .order("logged_at", { ascending: false })
        .limit(6),
    ]);

  const measRows = (meas ?? []) as Measurement[];
  const weightSeries: WeightPoint[] = measRows
    .filter((m) => m.weight_kg != null)
    .map((m) => ({
      date: m.taken_at,
      label: new Date(m.taken_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      lb: Math.round(((m.weight_kg as number) / KG_PER_LB) * 10) / 10,
    }));

  const logs = hlogs ?? [];
  const habitAdherence: HabitAdherence[] = (habits ?? []).map((h) => ({
    id: h.id as string,
    title: h.title as string,
    target_per_week: h.target_per_week as number,
    logs_this_week: logs.filter((l) => l.habit_id === h.id).length,
  }));

  const latestMeasurement = measRows.length > 0 ? measRows[measRows.length - 1] : null;
  const recentActivity = (acts ?? []) as ActivityLog[];
  const score = (scoreRes.data as WellnessScore | null) ?? null;
  const hasAnyData =
    weightSeries.length > 0 ||
    habitAdherence.length > 0 ||
    recentActivity.length > 0 ||
    score?.score != null;

  return {
    hasConsent: Boolean(consent),
    score,
    weightSeries,
    latestMeasurement,
    habits: habitAdherence,
    recentActivity,
    hasAnyData,
  };
}
