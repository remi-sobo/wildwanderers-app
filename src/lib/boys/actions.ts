"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type BoysResult = { error: string | null; id?: string };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

export async function createProgram(input: {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
}): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim()) return { error: "Give the program a name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      org_id: ctx.orgId,
      name: input.name.trim(),
      status: "active",
      location: input.location?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "That did not save. Try again." };
  revalidatePath("/boys");
  return { error: null, id: data.id as string };
}

export async function addGroup(programId: string, name: string): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!name.trim()) return { error: "Name the cohort." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("program_groups")
    .insert({ org_id: ctx.orgId, program_id: programId, name: name.trim() });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export type ParticipantInput = {
  first_name: string;
  last_name: string;
  grade?: string;
  group_id?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
};

export async function addParticipant(programId: string, input: ParticipantInput): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.first_name.trim() || !input.last_name.trim()) return { error: "A first and last name are needed." };
  const grade = input.grade ? Number(input.grade) : null;
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 12)) {
    return { error: "Grade is 1 to 12." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("participants").insert({
    org_id: ctx.orgId,
    program_id: programId,
    group_id: input.group_id || null,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    grade,
    parent_name: input.parent_name?.trim() || null,
    parent_email: input.parent_email?.trim() || null,
    parent_phone: input.parent_phone?.trim() || null,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export async function moveParticipant(
  programId: string,
  participantId: string,
  groupId: string | null,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("participants")
    .update({ group_id: groupId, updated_at: new Date().toISOString() })
    .eq("id", participantId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export type SessionInput = { title: string; location?: string; starts_at: string; ends_at?: string; group_id?: string };

export async function addSession(programId: string, input: SessionInput): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.title.trim()) return { error: "Give the session a title." };
  if (!input.starts_at) return { error: "Pick a start time." };

  const supabase = await createClient();
  const { error } = await supabase.from("program_sessions").insert({
    org_id: ctx.orgId,
    program_id: programId,
    group_id: input.group_id || null,
    title: input.title.trim(),
    location: input.location?.trim() || null,
    starts_at: new Date(input.starts_at).toISOString(),
    ends_at: input.ends_at ? new Date(input.ends_at).toISOString() : null,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export async function markAttendance(
  programId: string,
  sessionId: string,
  participantId: string,
  status: "present" | "absent" | "late",
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("attendance").upsert(
    {
      org_id: ctx.orgId,
      program_id: programId,
      session_id: sessionId,
      participant_id: participantId,
      status,
      marked_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,participant_id" },
  );
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export async function awardBadge(
  programId: string,
  participantId: string,
  badgeId: string,
  note: string,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("participant_badges").insert({
    org_id: ctx.orgId,
    participant_id: participantId,
    badge_id: badgeId,
    note: note.trim() || null,
    awarded_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}
