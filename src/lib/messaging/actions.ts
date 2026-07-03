"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import type { Message } from "@/lib/data/messages";

export type SendResult = { error: string | null; message: Message | null };

// Sends a message on a thread the caller participates in. RLS enforces sender
// identity and thread ownership; the returned row lets the sender show it
// immediately while realtime carries it to the other party.
export async function sendMessage(threadId: string, content: string): Promise<SendResult> {
  const trimmed = content.trim();
  if (!trimmed) return { error: null, message: null };

  const session = await getSessionProfile();
  if (!session?.profile) return { error: "You are signed out.", message: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      org_id: session.profile.org_id,
      thread_id: threadId,
      sender_id: session.userId,
      sender_role: session.profile.role,
      content: trimmed,
    })
    .select("id, thread_id, sender_id, sender_role, content, created_at")
    .single();

  if (error || !data) return { error: "Your message did not send. Try again.", message: null };

  revalidatePath("/messages");
  return { error: null, message: data as Message };
}

// Marks the other party's messages read for the caller.
export async function markThreadRead(threadId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_thread_messages_read", { p_thread_id: threadId });
}

// Coach opens (or creates) the conversation with a client, then jumps into it.
export async function openThreadWithClient(clientId: string): Promise<void> {
  const { profile } = await requireOwnerOrCoach();
  const session = await getSessionProfile();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("coach_id", session!.userId)
    .eq("client_id", clientId)
    .maybeSingle();

  let threadId = existing?.id as string | undefined;
  if (!threadId) {
    const { data, error } = await supabase
      .from("message_threads")
      .insert({ org_id: profile.org_id, coach_id: session!.userId, client_id: clientId })
      .select("id")
      .single();
    if (error || !data) redirect("/messages");
    threadId = data!.id as string;
  }

  redirect(`/messages?t=${threadId}`);
}
