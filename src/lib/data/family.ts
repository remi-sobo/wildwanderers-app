import { createClient } from "@/lib/supabase/server";

export type FamilyBadge = { id: string; name: string; emoji: string | null; note: string | null; awarded_at: string };
export type FamilySession = { id: string; title: string; location: string | null; starts_at: string };
export type FamilyAttendance = { session_title: string; status: string; starts_at: string };
export type FamilyAdventure = { id: string; kind: string; title: string | null; body: string; entry_date: string };

export type FamilyChild = {
  id: string;
  first_name: string;
  last_name: string;
  program_name: string;
  cohort_name: string | null;
  upcoming: FamilySession[];
  recentAttendance: FamilyAttendance[];
  badges: FamilyBadge[];
  adventure: FamilyAdventure[];
  formsToSign: string[];
};

// The signed-in parent's children with their program, next sessions, recent
// attendance, and badges. Every read is RLS-scoped to the parent's own kids.
export async function getMyFamily(): Promise<FamilyChild[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: kids } = await supabase
    .from("participants")
    .select("id, first_name, last_name, program_id, group_id")
    .order("first_name");
  if (!kids || kids.length === 0) return [];

  const programIds = [...new Set(kids.map((k) => k.program_id as string))];
  const groupIds = kids.map((k) => k.group_id as string | null).filter(Boolean) as string[];
  const kidIds = kids.map((k) => k.id as string);

  const [{ data: programs }, { data: groups }, { data: sessions }, { data: badges }, { data: attendance }, { data: adventure }, { data: forms }, { data: acks }] =
    await Promise.all([
      supabase.from("programs").select("id, name").in("id", programIds),
      groupIds.length
        ? supabase.from("program_groups").select("id, name").in("id", groupIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase
        .from("program_sessions")
        .select("id, program_id, title, location, starts_at")
        .in("program_id", programIds)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true }),
      supabase
        .from("participant_badges")
        .select("id, participant_id, note, awarded_at, program_badges(name, emoji)")
        .in("participant_id", kidIds)
        .order("awarded_at", { ascending: false }),
      supabase
        .from("attendance")
        .select("participant_id, status, program_sessions(title, starts_at)")
        .in("participant_id", kidIds),
      // RLS returns only family-visible entries for the parent's own kids.
      supabase
        .from("adventure_entries")
        .select("id, participant_id, kind, title, body, entry_date")
        .in("participant_id", kidIds)
        .order("entry_date", { ascending: false }),
      supabase.from("forms").select("id, title, version, is_required, is_active"),
      supabase
        .from("form_acknowledgements")
        .select("form_id, form_version, participant_id")
        .in("participant_id", kidIds),
    ]);

  const programName = new Map((programs ?? []).map((p) => [p.id as string, p.name as string]));
  const groupName = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]));
  const requiredForms = (forms ?? []).filter((f) => f.is_required && f.is_active);

  return kids.map((kid) => {
    const pid = kid.program_id as string;
    return {
      id: kid.id as string,
      first_name: kid.first_name as string,
      last_name: kid.last_name as string,
      program_name: programName.get(pid) ?? "Program",
      cohort_name: kid.group_id ? groupName.get(kid.group_id as string) ?? null : null,
      upcoming: (sessions ?? [])
        .filter((s) => s.program_id === pid)
        .slice(0, 5)
        .map((s) => ({
          id: s.id as string,
          title: s.title as string,
          location: (s.location as string | null) ?? null,
          starts_at: s.starts_at as string,
        })),
      recentAttendance: (attendance ?? [])
        .filter((a) => a.participant_id === kid.id)
        .map((a) => {
          const sess = a.program_sessions as { title?: string; starts_at?: string } | { title?: string; starts_at?: string }[] | null;
          const s = Array.isArray(sess) ? sess[0] : sess;
          return { session_title: s?.title ?? "Session", status: a.status as string, starts_at: s?.starts_at ?? "" };
        })
        .sort((x, y) => (y.starts_at ?? "").localeCompare(x.starts_at ?? ""))
        .slice(0, 6),
      badges: (badges ?? [])
        .filter((b) => b.participant_id === kid.id)
        .map((b) => {
          const bd = b.program_badges as { name?: string; emoji?: string } | { name?: string; emoji?: string }[] | null;
          const bg = Array.isArray(bd) ? bd[0] : bd;
          return {
            id: b.id as string,
            name: bg?.name ?? "Badge",
            emoji: bg?.emoji ?? null,
            note: (b.note as string | null) ?? null,
            awarded_at: b.awarded_at as string,
          };
        }),
      adventure: (adventure ?? [])
        .filter((e) => e.participant_id === kid.id)
        .map((e) => ({
          id: e.id as string,
          kind: e.kind as string,
          title: (e.title as string | null) ?? null,
          body: e.body as string,
          entry_date: e.entry_date as string,
        })),
      formsToSign: requiredForms
        .filter(
          (f) =>
            !(acks ?? []).some(
              (a) => a.form_id === f.id && a.form_version === f.version && a.participant_id === kid.id,
            ),
        )
        .map((f) => f.title as string),
    };
  });
}
