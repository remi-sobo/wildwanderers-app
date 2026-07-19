import { createClient } from "@/lib/supabase/server";
import { getMyClient } from "@/lib/data/training";
import {
  PILLAR_ORDER,
  PILLAR_LABEL,
  type PillarKey,
  type Band,
} from "@/lib/longevity/pillars";

// Re-exported so existing server-side imports from this module keep working.
export { PILLAR_ORDER, PILLAR_LABEL };
export type { PillarKey, Band };

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

export type FoodLog = {
  id: string;
  logged_at: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  description: string | null;
  quantity: number;
  calories: number | null;
  protein_g: number | null;
};

export type TrackingHub = {
  clientId: string | null;
  hasConsent: boolean;
  habits: HabitToday[];
  latestMeasurement: Measurement | null;
  recentActivity: ActivityLog[];
  movementMinutes7d: number;
  todaysFood: FoodLog[];
  todaysCalories: number;
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
      todaysFood: [],
      todaysCalories: 0,
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

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { data: foods } = await supabase
    .from("food_logs")
    .select("id, logged_at, meal, description, quantity, calories, protein_g")
    .eq("client_id", client.id)
    .gte("logged_at", dayStart.toISOString())
    .order("logged_at", { ascending: true });
  const todaysFood = (foods ?? []) as FoodLog[];
  const todaysCalories = Math.round(
    todaysFood.reduce((sum, f) => sum + (f.calories ?? 0), 0),
  );

  return {
    clientId: client.id,
    hasConsent: Boolean(consent),
    habits: habitsToday,
    latestMeasurement: (meas?.[0] as Measurement | undefined) ?? null,
    recentActivity,
    movementMinutes7d,
    todaysFood,
    todaysCalories,
  };
}

export type WellnessScore = {
  score: number | null;
  consistency: number | null;
  movement: number | null;
  habits: number | null;
  inputs: {
    required_exercises: number;
    required_done: number;
    movement_minutes_7d: number;
    movement_target: number;
    active_habits: number;
  };
};

export type WeightPoint = { date: string; label: string; lb: number };

export type HabitAdherence = {
  id: string;
  title: string;
  target_per_week: number;
  logs_this_week: number;
};

export type Progress = {
  hasConsent: boolean;
  score: WellnessScore | null;
  weightSeries: WeightPoint[];
  habits: HabitAdherence[];
  hasAnyData: boolean;
};

// Everything the Progress surface renders for the signed-in client: the live
// wellness score with its components, weight over time, and habit adherence.
export async function getMyProgress(): Promise<Progress> {
  const client = await getMyClient();
  if (!client) {
    return { hasConsent: false, score: null, weightSeries: [], habits: [], hasAnyData: false };
  }

  const supabase = await createClient();
  const weekAgoDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const [{ data: consent }, scoreRes, { data: meas }, { data: habits }, { data: hlogs }] =
    await Promise.all([
      supabase
        .from("consents")
        .select("id")
        .eq("client_id", client.id)
        .eq("kind", "health_tracking")
        .limit(1)
        .maybeSingle(),
      supabase.rpc("compute_wellness_score", { p_client_id: client.id }),
      supabase
        .from("measurements")
        .select("taken_at, weight_kg")
        .eq("client_id", client.id)
        .not("weight_kg", "is", null)
        .order("taken_at", { ascending: true }),
      supabase
        .from("habits")
        .select("id, title, target_per_week")
        .eq("client_id", client.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("client_id", client.id)
        .gte("logged_on", weekAgoDate),
    ]);

  const weightSeries: WeightPoint[] = (meas ?? []).map((m) => {
    const kg = m.weight_kg as number;
    return {
      date: m.taken_at as string,
      label: new Date(m.taken_at as string).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      lb: Math.round((kg / 0.45359237) * 10) / 10,
    };
  });

  const logs = hlogs ?? [];
  const habitAdherence: HabitAdherence[] = (habits ?? []).map((h) => ({
    id: h.id as string,
    title: h.title as string,
    target_per_week: h.target_per_week as number,
    logs_this_week: logs.filter((l) => l.habit_id === h.id).length,
  }));

  const score = (scoreRes.data as WellnessScore | null) ?? null;
  const hasAnyData =
    weightSeries.length > 0 || habitAdherence.length > 0 || (score?.score != null);

  return {
    hasConsent: Boolean(consent),
    score,
    weightSeries,
    habits: habitAdherence,
    hasAnyData,
  };
}

// ── Ring 6: the longevity profile (capacity, beside the daily ring) ──

export type LongevityPoint = { date: string; value: number };

export type LongevityTest = {
  assessmentId: string;
  name: string;
  slug: string;
  pillar: PillarKey;
  unit: string;
  higherIsBetter: boolean;
  howTo: string | null;
  isBodyComposition: boolean;
  usesCoachJudgment: boolean;
  latestValue: number | null;
  latestValueText: string | null;
  latestBand: Band | null;
  latestOn: string | null;
  previousValue: number | null;
  history: LongevityPoint[];
};

export type LongevityPillar = {
  pillar: PillarKey;
  label: string;
  tests: LongevityTest[];
};

export type Longevity = {
  hasConsent: boolean;
  showBodyComposition: boolean;
  pillars: LongevityPillar[];
  testedCount: number;
  totalCount: number;
};

export type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  pillar: PillarKey;
  unit: string;
  higher_is_better: boolean;
  how_to: string | null;
  is_body_composition: boolean;
  use_coach_judgment: boolean;
};

export type ResultRow = {
  assessment_id: string;
  value: number | null;
  value_text: string | null;
  band: Band | null;
  taken_on: string;
};

// Pure assembler shared by the client (getMyLongevity) and the coach
// (getClientLongevity) readers: group the catalog by pillar, attach each
// test's history and latest result, and hide body composition unless opted in.
export function assembleLongevity(
  catalog: CatalogRow[],
  results: ResultRow[],
  hasConsent: boolean,
  showBodyComposition: boolean,
): Longevity {
  const byAssessment = new Map<string, ResultRow[]>();
  for (const r of results) {
    const list = byAssessment.get(r.assessment_id) ?? [];
    list.push(r);
    byAssessment.set(r.assessment_id, list);
  }

  const tests: LongevityTest[] = catalog
    .filter((a) => showBodyComposition || !a.is_body_composition)
    .map((a) => {
      const rows = byAssessment.get(a.id) ?? [];
      const withValue = rows.filter((r) => r.value !== null) as (ResultRow & { value: number })[];
      const latest = rows.length ? rows[rows.length - 1] : null;
      const lastTwoValued = withValue.slice(-2);
      return {
        assessmentId: a.id,
        name: a.name,
        slug: a.slug,
        pillar: a.pillar,
        unit: a.unit,
        higherIsBetter: a.higher_is_better,
        howTo: a.how_to ?? null,
        isBodyComposition: a.is_body_composition,
        usesCoachJudgment: a.use_coach_judgment,
        latestValue: latest?.value ?? null,
        latestValueText: latest?.value_text ?? null,
        latestBand: latest?.band ?? null,
        latestOn: latest?.taken_on ?? null,
        previousValue: lastTwoValued.length === 2 ? lastTwoValued[0].value : null,
        history: withValue.map((r) => ({ date: r.taken_on, value: r.value })),
      };
    });

  const testedIds = new Set(results.map((r) => r.assessment_id));
  const pillars: LongevityPillar[] = PILLAR_ORDER.map((p) => ({
    pillar: p,
    label: PILLAR_LABEL[p],
    tests: tests.filter((t) => t.pillar === p),
  })).filter((grp) => grp.tests.length > 0);

  return {
    hasConsent,
    showBodyComposition,
    pillars,
    testedCount: tests.filter((t) => testedIds.has(t.assessmentId)).length,
    totalCount: tests.length,
  };
}

// The signed-in client's longevity profile: the seven pillars, each test's
// latest result and band, and its trend. A separate, periodic view of
// capacity, alongside (never merged into) the daily wellness ring. Body
// composition tests appear only if the client has opted in. RLS scopes the
// results to the client; the catalog is org-wide and read-only to them.
export async function getMyLongevity(): Promise<Longevity> {
  const client = await getMyClient();
  if (!client) {
    return { hasConsent: false, showBodyComposition: false, pillars: [], testedCount: 0, totalCount: 0 };
  }

  const supabase = await createClient();
  const [{ data: consent }, { data: bodyConsent }, { data: catalog }, { data: results }] =
    await Promise.all([
      supabase
        .from("consents")
        .select("id")
        .eq("client_id", client.id)
        .eq("kind", "health_tracking")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("consents")
        .select("id")
        .eq("client_id", client.id)
        .eq("kind", "body_composition")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("assessments")
        .select(
          "id, name, slug, pillar, unit, higher_is_better, how_to, is_body_composition, use_coach_judgment",
        )
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("assessment_results")
        .select("assessment_id, value, value_text, band, taken_on")
        .eq("client_id", client.id)
        .eq("subject", "client")
        .order("taken_on", { ascending: true }),
    ]);

  return assembleLongevity(
    (catalog ?? []) as CatalogRow[],
    (results ?? []) as ResultRow[],
    Boolean(consent),
    Boolean(bodyConsent),
  );
}
