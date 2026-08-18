"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { auditLog } from "@/lib/audit/log";

// Server actions for the intake record, the standing flags, and the
// post-session note. Staff-only: the client reads this data but never
// writes it (Gabe types the intake during the conversation). Every write
// is audited to the sealed ledger; metadata carries field names, never
// content.

export type IntakeActionResult = { error: string | null; id?: string };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile?.org_id || !["owner", "coach"].includes(session.profile.role)) return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function revalidateClientSurfaces(clientId: string) {
  revalidatePath(`/fitness/clients/${clientId}`);
  revalidatePath(`/fitness/clients/${clientId}/intake`);
  revalidatePath(`/program/clients/${clientId}`);
  revalidatePath(`/fitness`);
  revalidatePath(`/profile`);
}

// Save one or more intake sections. The intake is a living record: the row
// is created on the first save and edited in place after (updated_at is the
// version stamp). The goal is not stored here; it writes to clients.goal,
// the single source.
export async function saveIntake(
  clientId: string,
  input: { goal?: string; story?: string; lifestyle?: string },
): Promise<IntakeActionResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const fields: string[] = [];

  if (input.goal !== undefined) {
    const { error } = await supabase
      .from("clients")
      .update({ goal: input.goal.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", clientId)
      .eq("org_id", ctx.orgId);
    if (error) return { error: "That did not save. Try again." };
    fields.push("goal");
  }

  if (input.story !== undefined || input.lifestyle !== undefined) {
    const { data: existing } = await supabase
      .from("client_intakes")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();

    const patch: Record<string, unknown> = {};
    if (input.story !== undefined) {
      patch.story_md = input.story.trim() || null;
      fields.push("story_md");
    }
    if (input.lifestyle !== undefined) {
      patch.lifestyle_md = input.lifestyle.trim() || null;
      fields.push("lifestyle_md");
    }

    if (existing) {
      const { error } = await supabase
        .from("client_intakes")
        .update(patch)
        .eq("id", existing.id as string);
      if (error) return { error: "That did not save. Try again." };
    } else {
      const { error } = await supabase.from("client_intakes").insert({
        org_id: ctx.orgId,
        client_id: clientId,
        conducted_by: ctx.userId,
        ...patch,
      });
      if (error) return { error: "That did not save. Try again." };
    }
  }

  if (fields.length === 0) return { error: null };

  await auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: "client_intake.save",
    entityTable: "client_intakes",
    entityId: clientId,
    metadata: { fields },
  });

  revalidateClientSurfaces(clientId);
  return { error: null };
}

// Add a standing flag. Two prompted fields keep the language as a training
// accommodation: what to know, and what we adjust. created_from records
// whether it was promoted from the intake text or added from the profile.
export async function addFlag(
  clientId: string,
  input: { knowText: string; adjustText?: string; createdFrom?: "intake" | "manual" },
): Promise<IntakeActionResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const know = input.knowText.trim();
  if (!know) return { error: "Say what to know, in a line." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_flags")
    .insert({
      org_id: ctx.orgId,
      client_id: clientId,
      know_text: know,
      adjust_text: input.adjustText?.trim() || null,
      created_from: input.createdFrom ?? "manual",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: "client_flag.create",
    entityTable: "client_flags",
    entityId: clientId,
    metadata: { created_from: input.createdFrom ?? "manual" },
  });

  revalidateClientSurfaces(clientId);
  return { error: null, id: data?.id as string };
}

// Edit a flag's two fields in place.
export async function updateFlag(
  flagId: string,
  clientId: string,
  input: { knowText: string; adjustText?: string },
): Promise<IntakeActionResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const know = input.knowText.trim();
  if (!know) return { error: "Say what to know, in a line." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_flags")
    .update({ know_text: know, adjust_text: input.adjustText?.trim() || null })
    .eq("id", flagId)
    .eq("org_id", ctx.orgId);
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: "client_flag.update",
    entityTable: "client_flags",
    entityId: flagId,
    metadata: { fields: ["know_text", "adjust_text"] },
  });

  revalidateClientSurfaces(clientId);
  return { error: null };
}

// Resolve a flag (kept in history, off the band) or bring it back if it
// was resolved too soon.
export async function setFlagStatus(
  flagId: string,
  clientId: string,
  status: "active" | "resolved",
): Promise<IntakeActionResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_flags")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", flagId)
    .eq("org_id", ctx.orgId);
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: status === "resolved" ? "client_flag.resolve" : "client_flag.reopen",
    entityTable: "client_flags",
    entityId: flagId,
  });

  revalidateClientSurfaces(clientId);
  return { error: null };
}

// The post-session note: one line on how the session went, written on the
// session row itself. The client can read it (their session, their record).
export async function saveSessionNote(
  sessionId: string,
  clientId: string,
  note: string,
): Promise<IntakeActionResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ notes: note.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("org_id", ctx.orgId);
  if (error) return { error: "That did not save. Try again." };

  revalidateClientSurfaces(clientId);
  return { error: null };
}
