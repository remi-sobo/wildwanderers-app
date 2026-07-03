import { createClient } from "@/lib/supabase/server";
import { getMyClient } from "@/lib/data/training";

// UTC day key, matching the habit_logs.logged_on default in the migration.
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type HabitToday = {
  id: string;
  title: string;
  target_per_week: number;
  checked_today: boolean;
  logs_this_week: number;
};

export type Measurement = {
  id: string;
  taken_at: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
};

export type ActivityLog = {
  id: string;
  logged_at: string;
  kind: string;
  duration_minutes: number | null;
  estimated_energy_kcal: number | null;
};

export type TrackingHub = {
  clientId: string | null;
  hasConsent: boolean;
  habits: HabitToday[];
  latestMeasurement: Measurement | null;
  recentActivity: ActivityLog[];
  movementMinutes7d: number;
};

// Has the signed-in client granted health-tracking consent?
export async function getMyConsent(): Promise<boolean> {
  const client = await getMyClient();
  if (!client) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("client_id", client.id)
    .eq("kind", "health_tracking")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// Everything the Log hub needs for the signed-in client: their habits with
// today's check state and this week's count, their latest measurement, and
// recent movement. RLS scopes all of this to the client themselves.
export async function getTrackingHub(): Promise<TrackingHub> {
  const client = await getMyClient();
  if (!client) {
    return {
      clientId: null,
      hasConsent: false,
      habits: [],
      latestMeasurement: null,
      recentActivity: [],
      movementMinutes7d: 0,
    };
  }

  const supabase = await createClient();
  const today = todayKey();
  const weekAgoDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const weekAgoTs = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: consent }, { data: habits }, { data: hlogs }, { data: meas }, { data: acts }] =
    await Promise.all([
      supabase
        .from("consents")
        .select("id")
        .eq("client_id", client.id)
        .eq("kind", "health_tracking")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("habits")
        .select("id, title, target_per_week")
        .eq("client_id", client.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("habit_logs")
        .select("habit_id, logged_on")
        .eq("client_id", client.id)
        .gte("logged_on", weekAgoDate),
      supabase
        .from("measurements")
        .select(
          "id, taken_at, weight_kg, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, body_fat_pct, notes",
        )
        .eq("client_id", client.id)
        .order("taken_at", { ascending: false })
        .limit(1),
      supabase
        .from("activity_logs")
        .select("id, logged_at, kind, duration_minutes, estimated_energy_kcal")
        .eq("client_id", client.id)
        .order("logged_at", { ascending: false })
        .limit(5),
    ]);

  const logs = hlogs ?? [];
  const habitsToday: HabitToday[] = (habits ?? []).map((h) => {
    const forHabit = logs.filter((l) => l.habit_id === h.id);
    return {
      id: h.id as string,
      title: h.title as string,
      target_per_week: h.target_per_week as number,
      checked_today: forHabit.some((l) => l.logged_on === today),
      logs_this_week: forHabit.length,
    };
  });

  const recentActivity = (acts ?? []) as ActivityLog[];
  const { data: weekActs } = await supabase
    .from("activity_logs")
    .select("duration_minutes")
    .eq("client_id", client.id)
    .gte("logged_at", weekAgoTs);
  const movementMinutes7d = (weekActs ?? []).reduce(
    (sum, a) => sum + (a.duration_minutes ?? 0),
    0,
  );

  return {
    clientId: client.id,
    hasConsent: Boolean(consent),
    habits: habitsToday,
    latestMeasurement: (meas?.[0] as Measurement | undefined) ?? null,
    recentActivity,
    movementMinutes7d,
  };
}
