import { createClient } from "@/lib/supabase/server";

export type ProgramStatus = "setup" | "active" | "completed" | "archived";

export type ProgramSummary = {
  id: string;
  name: string;
  status: ProgramStatus;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  roster_count: number;
  next_session_at: string | null;
};

// All programs for staff, with a roster count and the next upcoming session.
export async function getPrograms(): Promise<ProgramSummary[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: programs }, { data: parts }, { data: sessions }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, status, location, start_date, end_date")
      .order("created_at", { ascending: false }),
    supabase.from("participants").select("program_id").eq("status", "active"),
    supabase
      .from("program_sessions")
      .select("program_id, starts_at")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true }),
  ]);

  const counts = new Map<string, number>();
  for (const p of parts ?? []) counts.set(p.program_id as string, (counts.get(p.program_id as string) ?? 0) + 1);
  const nextByProgram = new Map<string, string>();
  for (const s of sessions ?? []) {
    if (!nextByProgram.has(s.program_id as string)) nextByProgram.set(s.program_id as string, s.starts_at as string);
  }

  return (programs ?? []).map((p) => ({
    ...(p as Omit<ProgramSummary, "roster_count" | "next_session_at">),
    roster_count: counts.get(p.id as string) ?? 0,
    next_session_at: nextByProgram.get(p.id as string) ?? null,
  }));
}
