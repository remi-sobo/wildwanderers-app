import { createClient } from "@/lib/supabase/server";

// Reads for the intake record and the standing flags. RLS does the walling:
// staff read within their org, a client reads only their own record, so these
// helpers stay plain selects.

export type IntakeRow = {
  id: string;
  client_id: string;
  story_md: string | null;
  lifestyle_md: string | null;
  conducted_at: string;
  conducted_by: string | null;
  updated_at: string;
};

export type FlagStatus = "active" | "resolved";

export type FlagRow = {
  id: string;
  client_id: string;
  know_text: string;
  adjust_text: string | null;
  status: FlagStatus;
  created_from: "intake" | "manual";
  created_at: string;
  resolved_at: string | null;
};

const INTAKE_COLS = "id, client_id, story_md, lifestyle_md, conducted_at, conducted_by, updated_at";
const FLAG_COLS = "id, client_id, know_text, adjust_text, status, created_from, created_at, resolved_at";

// The one living intake for a client, or null before it is written.
export async function getClientIntake(clientId: string): Promise<IntakeRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_intakes")
    .select(INTAKE_COLS)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as IntakeRow | null) ?? null;
}

// Every flag for a client, active first, newest first within each group.
// Resolved flags stay in history; the band shows only the active ones.
export async function getClientFlags(clientId: string): Promise<FlagRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_flags")
    .select(FLAG_COLS)
    .eq("client_id", clientId)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });
  return (data as FlagRow[] | null) ?? [];
}

export function activeFlags(flags: FlagRow[]): FlagRow[] {
  return flags.filter((f) => f.status === "active");
}

// The signed-in client's own intake and flags (RLS already scopes both to
// their own record; the client_id filter is belt and braces).
export async function getMyIntakeAndFlags(
  clientId: string,
): Promise<{ intake: IntakeRow | null; flags: FlagRow[] }> {
  const [intake, flags] = await Promise.all([
    getClientIntake(clientId),
    getClientFlags(clientId),
  ]);
  return { intake, flags };
}

// The most recent assessment date per client, for the re-assessment cadence
// line on the coach's client list ("last assessed 8 weeks ago"). One query,
// reduced in memory; an org's client list is small.
export async function getLastAssessedByClient(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessment_results")
    .select("client_id, taken_on")
    .eq("subject", "client")
    .order("taken_on", { ascending: false });
  const latest = new Map<string, string>();
  for (const r of data ?? []) {
    const id = r.client_id as string | null;
    if (id && !latest.has(id)) latest.set(id, r.taken_on as string);
  }
  return latest;
}

// The most recent assessment date for one client, or null if never assessed.
export async function getLastAssessedForClient(clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessment_results")
    .select("taken_on")
    .eq("subject", "client")
    .eq("client_id", clientId)
    .order("taken_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.taken_on as string | null) ?? null;
}

// Plain-words cadence for a last-assessed date, or null if never assessed.
export function assessedAgoLabel(takenOn: string | null | undefined): string | null {
  if (!takenOn) return null;
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(takenOn + "T00:00:00").getTime()) / 86400000),
  );
  if (days < 7) return "assessed this week";
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "last assessed a week ago";
  if (weeks < 26) return `last assessed ${weeks} weeks ago`;
  return "last assessed over 6 months ago";
}
