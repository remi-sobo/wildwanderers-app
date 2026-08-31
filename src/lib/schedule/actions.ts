"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import type { ScheduleBlock } from "@/lib/data/schedule";

// Writers for the Schedule surface. Staff only; RLS backs every call
// (owner: the org's blocks, coach: their own). Task completion is not
// here on purpose: the on-block checkboxes call the existing
// setTaskDone in lib/tasks/actions, so recurrence and the task ledger
// behave the same from the calendar as from /tasks.

export type ScheduleResult = { error: string | null };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile || !session.profile.org_id) return null;
  if (session.profile.role !== "owner" && session.profile.role !== "coach") return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function refresh() {
  revalidatePath("/schedule");
}

const SAVE_FAILED = "That did not save. Try again.";

export type NewBlockInput = {
  day: number;
  start_min: number;
  end_min: number;
  title: string;
  block_type: string;
  location?: string;
  description?: string;
  recur?: string;
};

// Create returns the row so the editor can open on it right away.
export async function createBlock(
  input: NewBlockInput,
): Promise<ScheduleResult & { block?: ScheduleBlock }> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .insert({
      org_id: ctx.orgId,
      day: input.day,
      start_min: input.start_min,
      end_min: input.end_min,
      title: input.title.trim() || "New block",
      block_type: input.block_type,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      recur: input.recur || "weekly",
      created_by: ctx.userId,
    })
    .select("id, grp, day, start_min, end_min, title, location, description, block_type, recur")
    .single();
  if (error || !data) return { error: SAVE_FAILED };
  refresh();
  return { error: null, block: data as ScheduleBlock };
}

export type GroupEditInput = {
  title: string;
  location?: string;
  description?: string;
  block_type: string;
  recur: string;
  start_min: number;
  end_min: number;
};

// Title, location, description, type, times, and recur sync across the
// whole repeat group; only task links are per-day.
export async function updateGroup(grp: string, input: GroupEditInput): Promise<ScheduleResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (input.end_min <= input.start_min) return { error: "End the block after it starts." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .update({
      title: input.title.trim() || "Untitled block",
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      block_type: input.block_type,
      recur: input.recur,
      start_min: input.start_min,
      end_min: input.end_min,
    })
    .eq("grp", grp);
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

// Drag and resize touch only that day's instance of a group.
export async function moveBlock(
  id: string,
  input: { day: number; start_min: number; end_min: number },
): Promise<ScheduleResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (input.end_min <= input.start_min) return { error: "End the block after it starts." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .update({ day: input.day, start_min: input.start_min, end_min: input.end_min })
    .eq("id", id);
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

// The editor's day toggles: membership of the repeat group. Adding a
// day clones the group's shape onto it; removing one deletes that
// day's instance (its task links cascade). At least one day stays.
export async function setGroupDays(grp: string, days: number[]): Promise<ScheduleResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (days.length === 0) return { error: "A block needs at least one day." };
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("schedule_blocks")
    .select("id, day, start_min, end_min, title, location, description, block_type, recur")
    .eq("grp", grp);
  if (!existing || existing.length === 0) return { error: SAVE_FAILED };

  const have = new Set(existing.map((b) => b.day as number));
  const want = new Set(days);
  const template = existing[0];

  const toAdd = days.filter((d) => !have.has(d));
  const toRemove = existing.filter((b) => !want.has(b.day as number)).map((b) => b.id as string);

  if (toAdd.length > 0) {
    const { error } = await supabase.from("schedule_blocks").insert(
      toAdd.map((d) => ({
        org_id: ctx.orgId,
        grp,
        day: d,
        start_min: template.start_min,
        end_min: template.end_min,
        title: template.title,
        location: template.location,
        description: template.description,
        block_type: template.block_type,
        recur: template.recur,
        created_by: ctx.userId,
      })),
    );
    if (error) return { error: SAVE_FAILED };
  }
  if (toRemove.length > 0) {
    const { error } = await supabase.from("schedule_blocks").delete().in("id", toRemove);
    if (error) return { error: SAVE_FAILED };
  }
  refresh();
  return { error: null };
}

// Delete removes the whole repeat group.
export async function deleteGroup(grp: string): Promise<ScheduleResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_blocks").delete().eq("grp", grp);
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

// Publish a task onto a work block for one real week. The unique key
// (task_id, week_start) makes this a move when the task already sits on
// another block that week. Rollover reuses this with low positions so
// carried tasks land on top.
export async function linkTaskToBlock(
  blockId: string,
  taskId: string,
  weekStart: string,
  position: number,
): Promise<ScheduleResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_block_tasks").upsert(
    {
      org_id: ctx.orgId,
      block_id: blockId,
      task_id: taskId,
      week_start: weekStart,
      position,
    },
    { onConflict: "task_id,week_start" },
  );
  if (error) {
    if (error.code === "23514") return { error: "Only a Work block holds tasks." };
    return { error: SAVE_FAILED };
  }
  refresh();
  return { error: null };
}

export async function unlinkTask(taskId: string, weekStart: string): Promise<ScheduleResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_block_tasks")
    .delete()
    .eq("task_id", taskId)
    .eq("week_start", weekStart);
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

export type ScheduleSettingsInput = {
  start_hour?: number;
  end_hour?: number;
  travel_buffer_min?: number;
  default_len_min?: number;
  default_block_type?: string;
  colors?: Record<string, string>;
};

export async function saveScheduleSettings(input: ScheduleSettingsInput): Promise<ScheduleResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_settings").upsert(
    {
      profile_id: ctx.userId,
      org_id: ctx.orgId,
      ...input,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return { error: SAVE_FAILED };
  refresh();
  revalidatePath("/settings");
  return { error: null };
}
