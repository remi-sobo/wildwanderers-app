"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

// Writers for the one task system (specs/unified-tasks.md). Staff only;
// RLS backs every call (owner: the org, coach: assigned-or-created).

export type TaskResult = { error: string | null };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile || !session.profile.org_id) return null;
  if (session.profile.role !== "owner" && session.profile.role !== "coach") return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function refreshTaskSurfaces() {
  revalidatePath("/tasks");
  revalidatePath("/business");
  revalidatePath("/business/pipeline");
  revalidatePath("/program");
}

export type NewTaskInput = {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  due_date?: string;
  pin_today?: boolean;
  assigned_to?: string;
  recur?: string;
  lead_id?: string;
  client_id?: string;
  customer_id?: string;
  program_id?: string;
  is_next_step?: boolean;
};

export async function addTask(input: NewTaskInput): Promise<TaskResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.title.trim()) return { error: "A title is needed." };

  const supabase = await createClient();
  const { error } = await supabase.from("business_tasks").insert({
    org_id: ctx.orgId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category || "other",
    priority: input.priority || "medium",
    due_date: input.due_date || null,
    pin_today: Boolean(input.pin_today),
    assigned_to: input.assigned_to || ctx.userId,
    recur: input.recur || "none",
    lead_id: input.lead_id || null,
    client_id: input.client_id || null,
    customer_id: input.customer_id || null,
    program_id: input.program_id || null,
    is_next_step: Boolean(input.is_next_step),
    created_by: ctx.userId,
  });
  if (error) {
    if (error.code === "23505") return { error: "This lead already has a next step." };
    return { error: "That did not save. Try again." };
  }
  refreshTaskSurfaces();
  return { error: null };
}

export type EditTaskInput = {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  due_date?: string;
  assigned_to?: string;
  recur?: string;
};

export async function updateTask(taskId: string, input: EditTaskInput): Promise<TaskResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.title.trim()) return { error: "A title is needed." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_tasks")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category || "other",
      priority: input.priority || "medium",
      due_date: input.due_date || null,
      assigned_to: input.assigned_to || null,
      recur: input.recur || "none",
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { error: "That did not save. Try again." };
  refreshTaskSurfaces();
  return { error: null };
}

export async function setTaskDone(taskId: string, done: boolean): Promise<TaskResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_tasks")
    .update({
      status: done ? "done" : "open",
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { error: "That did not save. Try again." };
  refreshTaskSurfaces();
  return { error: null };
}

export async function toggleTaskPin(taskId: string, pin: boolean): Promise<TaskResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_tasks")
    .update({ pin_today: pin, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { error: "That did not save. Try again." };
  refreshTaskSurfaces();
  return { error: null };
}

export async function addTaskComment(taskId: string, content: string): Promise<TaskResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!content.trim()) return { error: "Write the comment first." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    org_id: ctx.orgId,
    task_id: taskId,
    content: content.trim(),
    created_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/tasks");
  return { error: null };
}

// The lead's next step is a task. Setting a new one supersedes any open
// next-step task (cancelled, not done: it was replaced, not finished).
export async function setNextStep(
  leadId: string,
  title: string,
  dueDate?: string,
): Promise<TaskResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!title.trim()) return { error: "Say what the next step is." };

  const supabase = await createClient();
  await supabase
    .from("business_tasks")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("is_next_step", true)
    .in("status", ["open", "in_progress"]);

  return addTask({
    title,
    category: "sales",
    due_date: dueDate,
    lead_id: leadId,
    is_next_step: true,
  });
}

// A closed lead needs no next step; called on won and lost transitions.
export async function cancelNextStep(leadId: string): Promise<void> {
  const ctx = await staffContext();
  if (!ctx) return;
  const supabase = await createClient();
  await supabase
    .from("business_tasks")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("is_next_step", true)
    .in("status", ["open", "in_progress"]);
}

// The lazy sweep; the /tasks page calls this on load. Errors are
// swallowed into a zero, the surface still renders.
export async function runTaskSweep(): Promise<number> {
  const ctx = await staffContext();
  if (!ctx) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_tasks");
  if (error) return 0;
  return (data as number | null) ?? 0;
}
