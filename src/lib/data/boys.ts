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

export type Program = {
  id: string;
  name: string;
  status: ProgramStatus;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};
export type ProgramGroup = { id: string; name: string; color: string | null };
export type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  group_id: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  status: "active" | "inactive";
  parent_user_id: string | null;
};
export type ProgramSession = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  group_id: string | null;
};
export type Badge = { id: string; name: string; emoji: string | null; description: string | null };
export type BadgeAward = {
  id: string;
  participant_id: string;
  badge_id: string;
  note: string | null;
  awarded_at: string;
  badge_name: string;
  badge_emoji: string | null;
};

export type AttendanceRow = {
  session_id: string;
  participant_id: string;
  status: "present" | "absent" | "late";
};

export type ProgramDetail = {
  program: Program;
  groups: ProgramGroup[];
  participants: Participant[];
  sessions: ProgramSession[];
  badges: Badge[];
  awards: BadgeAward[];
  attendance: AttendanceRow[];
};

// A full program for the detail surface: cohorts, roster, sessions, the badge
// catalog, and awards, all staff-scoped by RLS.
export async function getProgram(id: string): Promise<ProgramDetail | null> {
  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, name, status, location, start_date, end_date, description")
    .eq("id", id)
    .maybeSingle();
  if (!program) return null;

  const [{ data: groups }, { data: participants }, { data: sessions }, { data: badges }] =
    await Promise.all([
      supabase.from("program_groups").select("id, name, color").eq("program_id", id).order("created_at"),
      supabase
        .from("participants")
        .select("id, first_name, last_name, grade, group_id, parent_name, parent_email, parent_phone, status, parent_user_id")
        .eq("program_id", id)
        .order("first_name"),
      supabase
        .from("program_sessions")
        .select("id, title, location, starts_at, ends_at, group_id")
        .eq("program_id", id)
        .order("starts_at", { ascending: true }),
      supabase.from("program_badges").select("id, name, emoji, description").order("sort_order"),
    ]);

  const participantIds = (participants ?? []).map((p) => p.id as string);
  const [{ data: awards }, { data: attendance }] = await Promise.all([
    participantIds.length
      ? supabase
          .from("participant_badges")
          .select("id, participant_id, badge_id, note, awarded_at, program_badges(name, emoji)")
          .in("participant_id", participantIds)
          .order("awarded_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from("attendance").select("session_id, participant_id, status").eq("program_id", id),
  ]);

  type AwardRaw = {
    id: string;
    participant_id: string;
    badge_id: string;
    note: string | null;
    awarded_at: string;
    program_badges: { name?: string; emoji?: string } | { name?: string; emoji?: string }[] | null;
  };
  const awardRows: BadgeAward[] = ((awards ?? []) as AwardRaw[]).map((a) => {
    const b = a.program_badges;
    const badge = Array.isArray(b) ? b[0] : b;
    return {
      id: a.id as string,
      participant_id: a.participant_id as string,
      badge_id: a.badge_id as string,
      note: (a.note as string | null) ?? null,
      awarded_at: a.awarded_at as string,
      badge_name: badge?.name ?? "Badge",
      badge_emoji: badge?.emoji ?? null,
    };
  });

  return {
    program: program as Program,
    groups: (groups ?? []) as ProgramGroup[],
    participants: (participants ?? []) as Participant[],
    sessions: (sessions ?? []) as ProgramSession[],
    badges: (badges ?? []) as Badge[],
    awards: awardRows,
    attendance: (attendance ?? []) as AttendanceRow[],
  };
}
