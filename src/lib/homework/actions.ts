"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

// Writers for the homework loop. The coach assigns and can withdraw; the
// client flips status and leaves their note. RLS backs every call, and
// the database guard trigger holds the column line for clients (only
// status, completed_at, and completion_note on their own rows).

export type HomeworkResult = { error: string | null };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile || !session.profile.org_id) return null;
  if (session.profile.role !== "owner" && session.profile.role !== "coach") return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

async function clientContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "client") return null;
  return { userId: session.userId };
}

export type AssignHomeworkInput = {
  title: string;
  details_md?: string;
  due_date?: string;
};

export async function assignHomework(
  clientId: string,
  input: AssignHomeworkInput,
): Promise<HomeworkResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.title.trim()) return { error: "Say what the homework is." };

  const supabase = await createClient();
  const { error } = await supabase.from("client_homework").insert({
    org_id: ctx.orgId,
    client_id: clientId,
    title: input.title.trim(),
    details_md: input.details_md?.trim() || null,
    due_date: input.due_date || null,
    assigned_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/program/clients/${clientId}`);
  revalidatePath("/homework");
  return { error: null };
}

// Withdraw an assignment that should not have gone out. Staff only.
export async function removeHomework(id: string, clientId: string): Promise<HomeworkResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_homework").delete().eq("id", id);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/program/clients/${clientId}`);
  revalidatePath("/homework");
  return { error: null };
}

// The client checks their own homework done, or reopens it. RLS keeps
// this to their own rows; the guard trigger keeps it to these columns.
export async function setHomeworkDone(id: string, done: boolean): Promise<HomeworkResult> {
  const ctx = await clientContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_homework")
    .update({
      status: done ? "done" : "assigned",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/homework");
  return { error: null };
}

// The optional "how did it go" note, saveable after the fact.
export async function saveHomeworkNote(id: string, note: string): Promise<HomeworkResult> {
  const ctx = await clientContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_homework")
    .update({ completion_note: note.trim() || null })
    .eq("id", id);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/homework");
  return { error: null };
}
