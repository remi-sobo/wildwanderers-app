import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type ThreadSummary = {
  id: string;
  client_id: string;
  coach_id: string;
  other_name: string;
  last_message_preview: string | null;
  last_message_at: string | null;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  created_at: string;
};

// Threads visible to the current user, newest activity first. Shows the other
// party's name: the client's name for staff, a generic label for a client (a
// client cannot read the coach's profile under RLS).
export async function getThreads(): Promise<ThreadSummary[]> {
  const supabase = await createClient();
  const session = await getSessionProfile();
  const isClient = session?.profile?.role === "client";

  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, client_id, coach_id, last_message_preview, last_message_at")
    .order("last_message_at", { ascending: false });

  if (!threads || threads.length === 0) return [];

  let nameById = new Map<string, string>();
  if (!isClient) {
    const clientIds = threads.map((t) => t.client_id as string);
    const { data: clients } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .in("id", clientIds);
    nameById = new Map(
      (clients ?? []).map((c) => [
        c.id as string,
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Client",
      ]),
    );
  }

  return threads.map((t) => ({
    id: t.id as string,
    client_id: t.client_id as string,
    coach_id: t.coach_id as string,
    other_name: isClient ? "Your coach" : nameById.get(t.client_id as string) ?? "Client",
    last_message_preview: (t.last_message_preview as string | null) ?? null,
    last_message_at: (t.last_message_at as string | null) ?? null,
  }));
}

export async function getMessages(threadId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, thread_id, sender_id, sender_role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  return (data as Message[] | null) ?? [];
}
