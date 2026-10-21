"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

// Writers for My three and This Week's Five (specs/week.md). Each call
// replaces the whole day or week in one database transaction, as the
// caller, so RLS checks every pick and the caps cannot be passed.

export type WeekResult = { error: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAVE_FAILED = "That did not save. Try again.";

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile?.org_id) return null;
  if (session.profile.role !== "owner" && session.profile.role !== "coach") return null;
  return { userId: session.userId };
}

function refresh() {
  revalidatePath("/today");
  revalidatePath("/week");
}

export async function setDayFocus(dateKey: string, taskIds: string[]): Promise<WeekResult> {
  if (!(await staffContext())) return { error: "You are signed out." };
  if (!DATE.test(dateKey) || !taskIds.every((id) => UUID.test(id))) return { error: SAVE_FAILED };
  if (taskIds.length > 3) return { error: "Today already has three. Take one off first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_day_focus", { p_date: dateKey, p_task_ids: taskIds });
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

export async function setWeekFive(weekStartKey: string, taskIds: string[]): Promise<WeekResult> {
  if (!(await staffContext())) return { error: "You are signed out." };
  if (!DATE.test(weekStartKey) || !taskIds.every((id) => UUID.test(id))) return { error: SAVE_FAILED };
  if (taskIds.length > 5) return { error: "The week already has five. Take one off first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_week_five", { p_week: weekStartKey, p_task_ids: taskIds });
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}
