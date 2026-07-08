"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { getTemplateWithWorkouts } from "@/lib/data/templates";
import type { PlanDraft } from "@/lib/coach/actions";

export type SaveTemplateResult = { error: string | null; saved: boolean };

// Saves the builder's current shape as a reusable, client-agnostic template.
// Only owner/coach may call it; the RPC writes under the caller's RLS.
export async function saveAsTemplate(draft: PlanDraft): Promise<SaveTemplateResult> {
  await requireOwnerOrCoach();

  if (!draft.title.trim()) return { error: "Give the template a title first.", saved: false };
  const workouts = draft.workouts.filter((w) =>
    w.exercises.some((e) => e.title.trim()),
  );
  if (workouts.length === 0) {
    return { error: "Add at least one workout with an exercise first.", saved: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_plan_template_atomic", {
    p_template: {
      title: draft.title.trim(),
      goal: draft.goal.trim() || null,
      duration_weeks: draft.durationWeeks || null,
    },
    p_workouts: workouts.map((w) => ({
      day_number: w.dayNumber,
      week_number: w.weekNumber,
      title: w.title.trim() || null,
      exercises: w.exercises
        .filter((e) => e.title.trim())
        .map((e, i) => ({
          title: e.title.trim(),
          kind: e.kind,
          sets: e.sets,
          reps: e.reps,
          rest_seconds: e.rest_seconds,
          load: e.load,
          instructions: e.instructions,
          sort_order: i,
          is_optional: e.is_optional,
          library_item_id: e.library_item_id,
          media_url: e.media_url,
        })),
    })),
  });
  if (error) return { error: "We could not save the template. Try again.", saved: false };

  revalidatePath("/program/templates");
  return { error: null, saved: true };
}

// Instantiates a template into a resting draft for one client and opens it in
// the builder. Template -> draft -> review -> activate, one path.
export async function startPlanFromTemplate(
  clientId: string,
  templateId: string,
): Promise<{ error: string | null }> {
  await requireOwnerOrCoach();

  const template = await getTemplateWithWorkouts(templateId);
  if (!template) return { error: "That template was not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_plan_atomic", {
    p_plan: {
      client_id: clientId,
      title: template.title,
      goal: template.goal,
      duration_weeks: template.duration_weeks != null ? String(template.duration_weeks) : null,
      notes: template.notes,
    },
    p_workouts: template.workouts.map((w) => ({
      day_number: w.day_number,
      week_number: w.week_number,
      title: w.title,
      exercises: w.exercises.map((e) => ({
        title: e.title,
        kind: e.kind,
        sets: e.sets != null ? String(e.sets) : "",
        reps: e.reps,
        rest_seconds: e.rest_seconds != null ? String(e.rest_seconds) : "",
        load: e.load,
        instructions: e.instructions,
        sort_order: e.sort_order,
        is_optional: e.is_optional,
        library_item_id: e.library_item_id,
        media_url: e.media_url,
      })),
    })),
  });
  if (error || !data?.plan_id) {
    return { error: "We could not start from that template. Try again." };
  }

  revalidatePath(`/program/clients/${clientId}`);
  redirect(`/program/clients/${clientId}/plan/new?draft=${data.plan_id}`);
}

// Renames a template on the manage surface.
export async function renameTemplate(templateId: string, formData: FormData): Promise<void> {
  await requireOwnerOrCoach();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase
    .from("plan_templates")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", templateId);
  revalidatePath("/program/templates");
}

// Retire or bring back a template. Retired templates leave the start-from
// picker but keep their history; nothing built from them changes.
export async function setTemplateActive(templateId: string, active: boolean): Promise<void> {
  await requireOwnerOrCoach();
  const supabase = await createClient();
  await supabase
    .from("plan_templates")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", templateId);
  revalidatePath("/program/templates");
}

// Share a template with clients, or take it back. Per template, deliberate,
// default off; shared ones show in the client's own builder as a start.
export async function setTemplateClientVisible(
  templateId: string,
  visible: boolean,
): Promise<void> {
  await requireOwnerOrCoach();
  const supabase = await createClient();
  await supabase
    .from("plan_templates")
    .update({ is_client_visible: visible, updated_at: new Date().toISOString() })
    .eq("id", templateId);
  revalidatePath("/program/templates");
  revalidatePath("/training/build");
}
