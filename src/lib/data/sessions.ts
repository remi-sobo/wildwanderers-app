import { createClient } from "@/lib/supabase/server";

export type SessionRow = {
  id: string;
  title: string;
  kind: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  client_id: string | null;
};

// Upcoming (non-cancelled) sessions for a client, soonest first.
export async function getUpcomingSessionsForClient(
  clientId: string,
): Promise<SessionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, title, kind, start_at, end_at, location, notes, client_id")
    .eq("client_id", clientId)
    .eq("is_cancelled", false)
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true });
  return (data as SessionRow[] | null) ?? [];
}

// The current user's own next upcoming session (client Home).
export async function getMyNextSession(): Promise<SessionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, title, kind, start_at, end_at, location, notes, client_id")
    .eq("is_cancelled", false)
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}
