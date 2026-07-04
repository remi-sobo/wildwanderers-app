"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyClient } from "@/lib/data/training";
import { auditLog } from "@/lib/audit/log";
import { lbToKg, inToCm } from "@/lib/wellness/units";

export type ActionResult = { error: string | null };

// Recompute and store a fresh wellness snapshot for a client, best-effort.
// A failed snapshot never fails the log that triggered it.
async function snapshot(clientId: string) {
  try {
    const supabase = await createClient();
    await supabase.rpc("snapshot_wellness_score", { p_client_id: clientId });
  } catch {
    // best-effort
  }
}

// The signed-in client grants health-tracking consent. Opens the tracker.
export async function grantConsent(): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const supabase = await createClient();
  const { error } = await supabase.from("consents").insert({
    org_id: session.profile.org_id,
    client_id: client.id,
    kind: "health_tracking",
    granted_by: session.userId,
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "consent.grant",
    entityTable: "consents",
    entityId: client.id,
    metadata: { kind: "health_tracking" },
  });

  revalidatePath("/log");
  revalidatePath("/progress");
  return { error: null };
}

export type MeasurementInput = {
  weight_lb?: string;
  waist_in?: string;
  hip_in?: string;
  chest_in?: string;
  arm_in?: string;
  thigh_in?: string;
  body_fat_pct?: string;
  notes?: string;
};

function numOrNull(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Log a measurement. UI is imperial; we store canonical metric. Every field
// is optional, log what you have; a row with nothing in it is rejected.
export async function logMeasurement(input: MeasurementInput): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const weightLb = numOrNull(input.weight_lb);
  const waistIn = numOrNull(input.waist_in);
  const hipIn = numOrNull(input.hip_in);
  const chestIn = numOrNull(input.chest_in);
  const armIn = numOrNull(input.arm_in);
  const thighIn = numOrNull(input.thigh_in);
  const bodyFat = numOrNull(input.body_fat_pct);

  const row = {
    weight_kg: weightLb === null ? null : Number(lbToKg(weightLb).toFixed(2)),
    waist_cm: waistIn === null ? null : Number(inToCm(waistIn).toFixed(1)),
    hip_cm: hipIn === null ? null : Number(inToCm(hipIn).toFixed(1)),
    chest_cm: chestIn === null ? null : Number(inToCm(chestIn).toFixed(1)),
    arm_cm: armIn === null ? null : Number(inToCm(armIn).toFixed(1)),
    thigh_cm: thighIn === null ? null : Number(inToCm(thighIn).toFixed(1)),
    body_fat_pct: bodyFat === null ? null : Number(bodyFat.toFixed(1)),
  };

  const hasAny = Object.values(row).some((v) => v !== null);
  if (!hasAny) return { error: "Add at least one measurement." };

  const supabase = await createClient();
  const { error } = await supabase.from("measurements").insert({
    org_id: session.profile.org_id,
    client_id: client.id,
    ...row,
    notes: input.notes?.trim() || null,
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "measurement.create",
    entityTable: "measurements",
    entityId: client.id,
    // Field NAMES only, never values.
    metadata: { fields: Object.keys(row).filter((k) => row[k as keyof typeof row] !== null) },
  });

  await snapshot(client.id);
  revalidatePath("/log");
  revalidatePath("/progress");
  return { error: null };
}

// Check a habit off for today, or clear it. RLS keeps this to the client's own.
export async function toggleHabitToday(
  habitId: string,
  on: boolean,
): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  if (on) {
    const { error } = await supabase
      .from("habit_logs")
      .upsert(
        {
          org_id: session.profile.org_id,
          client_id: client.id,
          habit_id: habitId,
          logged_on: today,
        },
        { onConflict: "habit_id,logged_on", ignoreDuplicates: true },
      );
    if (error) return { error: "That did not save. Try again." };
  } else {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", habitId)
      .eq("client_id", client.id)
      .eq("logged_on", today);
    if (error) return { error: "That did not save. Try again." };
  }

  await snapshot(client.id);
  revalidatePath("/log");
  revalidatePath("/progress");
  return { error: null };
}

// ── Ring 6: the longevity profile ──

export type AssessmentInput = {
  assessmentId: string;
  value?: string;
  valueText?: string;
};

// The signed-in client records their own self-reported test result. The band
// is stamped by the database trigger from the catalog thresholds, never here.
export async function recordSelfAssessment(input: AssessmentInput): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };
  if (!input.assessmentId) return { error: "Pick a test first." };

  const value = numOrNull(input.value);
  const valueText = input.valueText?.trim() || null;
  if (value === null && !valueText) return { error: "Enter a result." };

  const supabase = await createClient();
  const { error } = await supabase.from("assessment_results").insert({
    org_id: session.profile.org_id,
    assessment_id: input.assessmentId,
    subject: "client",
    client_id: client.id,
    value,
    value_text: valueText,
    source: "self_reported",
    recorded_by: session.userId,
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "assessment_result.create",
    entityTable: "assessment_results",
    entityId: client.id,
    // A label (which test) and the source, never the measured value.
    metadata: { assessment_id: input.assessmentId, source: "self_reported" },
  });

  revalidatePath("/progress");
  return { error: null };
}

// Turn body composition (body fat, progress photos) on. Opt-in, private,
// separate from the base health-tracking consent, and easy to turn off.
export async function grantBodyCompositionConsent(): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const supabase = await createClient();
  const { error } = await supabase.from("consents").insert({
    org_id: session.profile.org_id,
    client_id: client.id,
    kind: "body_composition",
    granted_by: session.userId,
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "consent.grant",
    entityTable: "consents",
    entityId: client.id,
    metadata: { kind: "body_composition" },
  });

  revalidatePath("/progress");
  return { error: null };
}

// Turn body composition back off. Removes the opt-in; the tests stop showing.
export async function revokeBodyCompositionConsent(): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("consents")
    .delete()
    .eq("client_id", client.id)
    .eq("kind", "body_composition");
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "consent.revoke",
    entityTable: "consents",
    entityId: client.id,
    metadata: { kind: "body_composition" },
  });

  revalidatePath("/progress");
  return { error: null };
}

export type ActivityInput = {
  kind: string;
  duration_minutes?: string;
  notes?: string;
};

// Log a bout of movement.
export async function logActivity(input: ActivityInput): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const kind = input.kind.trim();
  if (!kind) return { error: "What did you do?" };
  const minutes = numOrNull(input.duration_minutes);

  const supabase = await createClient();
  const { error } = await supabase.from("activity_logs").insert({
    org_id: session.profile.org_id,
    client_id: client.id,
    kind,
    duration_minutes: minutes === null ? null : Math.round(minutes),
    source: "manual",
    notes: input.notes?.trim() || null,
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "activity.create",
    entityTable: "activity_logs",
    entityId: client.id,
    metadata: { has_duration: minutes !== null },
  });

  await snapshot(client.id);
  revalidatePath("/log");
  revalidatePath("/progress");
  return { error: null };
}
