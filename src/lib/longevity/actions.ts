"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { auditLog } from "@/lib/audit/log";
import type { PillarKey } from "@/lib/data/wellness";

export type LongevityResult = { error: string | null; id?: string };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile?.org_id || !["owner", "coach"].includes(session.profile.role)) return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function numOrNull(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type RecordSource = "coach_observed" | "device_estimate";

// A coach records a result for a client. The band is stamped by the trigger.
// Defaults to coach-observed; device estimates (VO2, HRV) mark the source so
// the profile frames them as trend fuel, never a verdict.
export async function recordClientAssessment(
  clientId: string,
  input: { assessmentId: string; value?: string; valueText?: string; source?: RecordSource },
): Promise<LongevityResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.assessmentId) return { error: "Pick a test first." };

  const value = numOrNull(input.value);
  const valueText = input.valueText?.trim() || null;
  if (value === null && !valueText) return { error: "Enter a result." };

  const supabase = await createClient();
  const { error } = await supabase.from("assessment_results").insert({
    org_id: ctx.orgId,
    assessment_id: input.assessmentId,
    subject: "client",
    client_id: clientId,
    value,
    value_text: valueText,
    source: input.source ?? "coach_observed",
    recorded_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: "assessment_result.create",
    entityTable: "assessment_results",
    entityId: clientId,
    metadata: { assessment_id: input.assessmentId, source: input.source ?? "coach_observed" },
  });

  revalidatePath(`/fitness`);
  revalidatePath(`/program/clients/${clientId}`);
  return { error: null };
}

// Edit a catalog test's simple bands, its how-to, and whether it is active.
// Editing the bands re-stamps the existing results by touching value, so the
// profile reflects the new starting points at once.
export async function updateAssessment(
  assessmentId: string,
  input: { bandImproving?: string; bandHealthy?: string; howTo?: string; isActive?: boolean },
): Promise<LongevityResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.bandImproving !== undefined) patch.band_improving = numOrNull(input.bandImproving);
  if (input.bandHealthy !== undefined) patch.band_healthy = numOrNull(input.bandHealthy);
  if (input.howTo !== undefined) patch.how_to = input.howTo.trim() || null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const supabase = await createClient();
  const { error } = await supabase
    .from("assessments")
    .update(patch)
    .eq("id", assessmentId)
    .eq("org_id", ctx.orgId);
  if (error) return { error: "That did not save. Try again." };

  // Re-stamp the bands on existing results so the profile reflects the new
  // starting points at once. The trigger only fires on a value change, so we
  // compute the band the same way it does and write it directly (a direct
  // band update is not reverted by the trigger).
  if (input.bandImproving !== undefined || input.bandHealthy !== undefined) {
    await restampBands(supabase, assessmentId, ctx.orgId);
  }

  await auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: "assessment.update",
    entityTable: "assessments",
    entityId: assessmentId,
    metadata: { fields: Object.keys(patch).filter((k) => k !== "updated_at") },
  });

  revalidatePath(`/fitness/assessments`);
  return { error: null };
}

type Band = "healthy" | "improving" | "needs_attention";

function bandFor(
  value: number | null,
  higher: boolean,
  imp: number | null,
  healthy: number | null,
): Band | null {
  if (value === null || imp === null || healthy === null) return null;
  if (higher) {
    if (value >= healthy) return "healthy";
    if (value >= imp) return "improving";
    return "needs_attention";
  }
  if (value <= healthy) return "healthy";
  if (value <= imp) return "improving";
  return "needs_attention";
}

// Recompute and write bands for every result of one assessment, grouped so it
// is a few updates, not one per row.
async function restampBands(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessmentId: string,
  orgId: string,
): Promise<void> {
  const { data: a } = await supabase
    .from("assessments")
    .select("higher_is_better, band_improving, band_healthy")
    .eq("id", assessmentId)
    .single();
  if (!a) return;
  const { data: rows } = await supabase
    .from("assessment_results")
    .select("id, value")
    .eq("assessment_id", assessmentId)
    .eq("org_id", orgId);

  const buckets = new Map<Band | "null", string[]>();
  for (const r of rows ?? []) {
    const band = bandFor(
      r.value as number | null,
      a.higher_is_better as boolean,
      a.band_improving as number | null,
      a.band_healthy as number | null,
    );
    const key = band ?? "null";
    const list = buckets.get(key) ?? [];
    list.push(r.id as string);
    buckets.set(key, list);
  }
  for (const [key, ids] of buckets) {
    if (ids.length === 0) continue;
    await supabase
      .from("assessment_results")
      .update({ band: key === "null" ? null : key })
      .in("id", ids);
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

// Add a custom test to the catalog. Pillar and unit are required; bands are
// optional (a test with no bands simply shows no band until Gabe sets them).
export async function addAssessment(input: {
  name: string;
  pillar: PillarKey;
  unit: string;
  higherIsBetter: boolean;
  howTo?: string;
  bandImproving?: string;
  bandHealthy?: string;
}): Promise<LongevityResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const name = input.name.trim();
  if (!name) return { error: "Name the test." };
  if (!input.unit.trim()) return { error: "What unit is it measured in?" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      org_id: ctx.orgId,
      name,
      slug: slugify(name),
      pillar: input.pillar,
      unit: input.unit.trim(),
      higher_is_better: input.higherIsBetter,
      how_to: input.howTo?.trim() || null,
      band_improving: numOrNull(input.bandImproving),
      band_healthy: numOrNull(input.bandHealthy),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "A test with that name already exists." };
    return { error: "That did not save. Try again." };
  }

  revalidatePath(`/fitness/assessments`);
  return { error: null, id: data?.id as string };
}
