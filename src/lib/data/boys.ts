import { createClient } from "@/lib/supabase/server";
import type { Band, PillarKey } from "@/lib/longevity/pillars";

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

// An earned-experience definition: an assessment that carries a boys name.
export type Experience = {
  assessmentId: string;
  experienceName: string;
  testName: string;
  pillar: PillarKey;
  unit: string;
  howTo: string | null;
  usesCoachJudgment: boolean;
};

// One recorded experience for a boy. The band is Gabe's quiet read; the boy
// sees the experience and his growth, never a grade.
export type EarnedExperience = {
  id: string;
  participant_id: string;
  assessmentId: string;
  experienceName: string;
  value: number | null;
  valueText: string | null;
  band: Band | null;
  taken_on: string;
};

// ── Ring 7: families, medical, emergency ──
export type Guardian = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
};
export type GuardianLink = {
  id: string;
  participant_id: string;
  guardian_id: string;
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
};
export type MedicalRecord = {
  participant_id: string;
  allergies: string | null;
  conditions: string | null;
  medications: string | null;
  notes: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  insurance_note: string | null;
};
export type EmergencyContact = {
  id: string;
  participant_id: string;
  name: string;
  relationship: string | null;
  phone: string;
  is_primary: boolean;
};
export type FormKind =
  | "waiver"
  | "medical"
  | "photo_release"
  | "pickup"
  | "code_of_conduct"
  | "parent_agreement";
export type FormDef = {
  id: string;
  kind: FormKind;
  title: string;
  body: string | null;
  version: number;
  is_required: boolean;
  is_active: boolean;
};
export type FormAck = {
  id: string;
  form_id: string;
  form_version: number;
  participant_id: string;
  signed_name: string | null;
  acknowledged_at: string;
};
export type EnrollmentStatus = "interested" | "waitlisted" | "offered" | "enrolled" | "withdrawn";
export type Enrollment = {
  id: string;
  participant_id: string;
  guardian_id: string | null;
  status: EnrollmentStatus;
  offering_id: string | null;
  tuition_cents: number | null;
  scholarship_cents: number;
  scholarship_reason: string | null;
  notes: string | null;
};
export type BoysOffering = { id: string; name: string; price_cents: number | null };
export type AdventureEntryKind = "journal" | "check_in" | "mentor_note";
export type AdventureEntry = {
  id: string;
  participant_id: string;
  kind: AdventureEntryKind;
  title: string | null;
  body: string;
  entry_date: string;
  visible_to_family: boolean;
};

export type ProgramDetail = {
  program: Program;
  groups: ProgramGroup[];
  participants: Participant[];
  sessions: ProgramSession[];
  badges: Badge[];
  awards: BadgeAward[];
  attendance: AttendanceRow[];
  experiences: Experience[];
  earned: EarnedExperience[];
  guardians: Guardian[];
  guardianLinks: GuardianLink[];
  medical: MedicalRecord[];
  emergency: EmergencyContact[];
  forms: FormDef[];
  acks: FormAck[];
  enrollments: Enrollment[];
  offerings: BoysOffering[];
  adventure: AdventureEntry[];
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

  const [{ data: groups }, { data: participants }, { data: sessions }, { data: badges }, { data: expCatalog }, { data: formRows }, { data: enrollRows }, { data: offeringRows }] =
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
      supabase
        .from("assessments")
        .select("id, name, pillar, unit, how_to, boys_experience_name, use_coach_judgment")
        .eq("is_active", true)
        .not("boys_experience_name", "is", null)
        .order("boys_experience_name"),
      supabase
        .from("forms")
        .select("id, kind, title, body, version, is_required, is_active")
        .order("kind"),
      supabase
        .from("enrollments")
        .select("id, participant_id, guardian_id, status, offering_id, tuition_cents, scholarship_cents, scholarship_reason, notes")
        .eq("program_id", id),
      supabase
        .from("offerings")
        .select("id, name, price_cents")
        .eq("kind", "boys_program")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  const participantIds = (participants ?? []).map((p) => p.id as string);
  const emptyResult = Promise.resolve({ data: [] as unknown[] });
  const [{ data: awards }, { data: attendance }, { data: results }, { data: links }, { data: medical }, { data: emergency }, { data: acks }, { data: adventure }] =
    await Promise.all([
      participantIds.length
        ? supabase
            .from("participant_badges")
            .select("id, participant_id, badge_id, note, awarded_at, program_badges(name, emoji)")
            .in("participant_id", participantIds)
            .order("awarded_at", { ascending: false })
        : emptyResult,
      supabase.from("attendance").select("session_id, participant_id, status").eq("program_id", id),
      participantIds.length
        ? supabase
            .from("assessment_results")
            .select("id, participant_id, assessment_id, value, value_text, band, taken_on")
            .eq("subject", "participant")
            .in("participant_id", participantIds)
            .order("taken_on", { ascending: false })
        : emptyResult,
      participantIds.length
        ? supabase
            .from("participant_guardians")
            .select("id, participant_id, guardian_id, relationship, is_primary, can_pickup")
            .in("participant_id", participantIds)
        : emptyResult,
      participantIds.length
        ? supabase
            .from("participant_medical")
            .select("participant_id, allergies, conditions, medications, notes, doctor_name, doctor_phone, insurance_note")
            .in("participant_id", participantIds)
        : emptyResult,
      participantIds.length
        ? supabase
            .from("emergency_contacts")
            .select("id, participant_id, name, relationship, phone, is_primary")
            .in("participant_id", participantIds)
        : emptyResult,
      participantIds.length
        ? supabase
            .from("form_acknowledgements")
            .select("id, form_id, form_version, participant_id, signed_name, acknowledged_at")
            .in("participant_id", participantIds)
        : emptyResult,
      participantIds.length
        ? supabase
            .from("adventure_entries")
            .select("id, participant_id, kind, title, body, entry_date, visible_to_family")
            .in("participant_id", participantIds)
            .order("entry_date", { ascending: false })
        : emptyResult,
    ]);

  const guardianLinks = (links ?? []) as GuardianLink[];
  const guardianIds = [...new Set(guardianLinks.map((l) => l.guardian_id))];
  const { data: guardianRows } = guardianIds.length
    ? await supabase
        .from("guardians")
        .select("id, first_name, last_name, email, phone, user_id")
        .in("id", guardianIds)
    : { data: [] as unknown[] };

  const experiences: Experience[] = ((expCatalog ?? []) as Record<string, unknown>[]).map((a) => ({
    assessmentId: a.id as string,
    experienceName: a.boys_experience_name as string,
    testName: a.name as string,
    pillar: a.pillar as PillarKey,
    unit: a.unit as string,
    howTo: (a.how_to as string | null) ?? null,
    usesCoachJudgment: a.use_coach_judgment as boolean,
  }));
  const expName = new Map(experiences.map((e) => [e.assessmentId, e.experienceName] as const));
  const earned: EarnedExperience[] = ((results ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    participant_id: r.participant_id as string,
    assessmentId: r.assessment_id as string,
    experienceName: expName.get(r.assessment_id as string) ?? "Experience",
    value: (r.value as number | null) ?? null,
    valueText: (r.value_text as string | null) ?? null,
    band: (r.band as Band | null) ?? null,
    taken_on: r.taken_on as string,
  }));

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
    experiences,
    earned,
    guardians: (guardianRows ?? []) as Guardian[],
    guardianLinks,
    medical: (medical ?? []) as MedicalRecord[],
    emergency: (emergency ?? []) as EmergencyContact[],
    forms: (formRows ?? []) as FormDef[],
    acks: (acks ?? []) as FormAck[],
    enrollments: (enrollRows ?? []) as Enrollment[],
    offerings: (offeringRows ?? []) as BoysOffering[],
    adventure: (adventure ?? []) as AdventureEntry[],
  };
}
