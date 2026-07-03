import { createClient } from "@/lib/supabase/server";
import { getMyClient } from "@/lib/data/training";

export type CheckInStructured = {
  summary?: string;
  mood?: string;
  wins?: string[];
  blockers?: string[];
  focus?: string;
} | null;

export type CheckIn = {
  id: string;
  created_at: string;
  kind: "text" | "voice";
  body: string | null;
  voice_url: string | null;
  structured: CheckInStructured;
  status: "open" | "reviewed" | "archived";
};

// The signed-in client's own recent check-ins.
export async function getMyCheckIns(limit = 5): Promise<CheckIn[]> {
  const client = await getMyClient();
  if (!client) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("id, created_at, kind, body, voice_url, structured, status")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as CheckIn[] | null) ?? [];
}

// A client's check-ins for the coach (RLS scopes to the coach's org).
export async function getClientCheckIns(clientId: string, limit = 10): Promise<CheckIn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("id, created_at, kind, body, voice_url, structured, status")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as CheckIn[] | null) ?? [];
}
