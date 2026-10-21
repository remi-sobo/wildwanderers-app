import { createClient } from "@/lib/supabase/server";
import type { CallItem } from "@/lib/advisor/calls";

// The advisor's calls (specs/advisor-calls.md). Advisor session only;
// RLS returns their own unexpired calls and nothing for anyone else.

export type CallSummary = {
  id: string;
  title: string;
  held_on: string;
  status: "new" | "extracted" | "sent";
  expires_at: string;
};

export type CallDetail = CallSummary & {
  org_id: string;
  transcript: string;
  agenda: string | null;
  items: CallItem[];
};

// Expired calls are deleted on the way in, so the list never shows one.
export async function getCalls(): Promise<CallSummary[]> {
  const supabase = await createClient();
  await supabase.rpc("purge_expired_calls");
  const { data } = await supabase
    .from("coaching_sessions")
    .select("id, title, held_on, status, expires_at")
    .order("held_on", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as CallSummary[];
}

export async function getCall(id: string): Promise<CallDetail | null> {
  const supabase = await createClient();
  const [{ data: call }, { data: items }] = await Promise.all([
    supabase
      .from("coaching_sessions")
      .select("id, org_id, title, held_on, status, expires_at, transcript, agenda")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("session_items")
      .select("id, section, text, owner, due_date, quote, quote_at, flag, match_task_id, state, send_as, keep_private, sent_task_id")
      .eq("session_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!call) return null;
  return { ...(call as Omit<CallDetail, "items">), items: (items ?? []) as CallItem[] };
}
