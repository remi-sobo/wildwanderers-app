"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type BoysResult = { error: string | null; id?: string };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) return null;
  return { userId: session.userId, orgId: session.profile.org_id, role: session.profile.role };
}

export async function createProgram(input: {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
}): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim()) return { error: "Give the program a name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      org_id: ctx.orgId,
      name: input.name.trim(),
      status: "active",
      location: input.location?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "That did not save. Try again." };
  revalidatePath("/boys");
  return { error: null, id: data.id as string };
}

export async function addGroup(programId: string, name: string): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!name.trim()) return { error: "Name the cohort." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("program_groups")
    .insert({ org_id: ctx.orgId, program_id: programId, name: name.trim() });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export type ParticipantInput = {
  first_name: string;
  last_name: string;
  grade?: string;
  group_id?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
};

export async function addParticipant(programId: string, input: ParticipantInput): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.first_name.trim() || !input.last_name.trim()) return { error: "A first and last name are needed." };
  const grade = input.grade ? Number(input.grade) : null;
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 12)) {
    return { error: "Grade is 1 to 12." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("participants").insert({
    org_id: ctx.orgId,
    program_id: programId,
    group_id: input.group_id || null,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    grade,
    parent_name: input.parent_name?.trim() || null,
    parent_email: input.parent_email?.trim() || null,
    parent_phone: input.parent_phone?.trim() || null,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export async function moveParticipant(
  programId: string,
  participantId: string,
  groupId: string | null,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("participants")
    .update({ group_id: groupId, updated_at: new Date().toISOString() })
    .eq("id", participantId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export type SessionInput = { title: string; location?: string; starts_at: string; ends_at?: string; group_id?: string };

export async function addSession(programId: string, input: SessionInput): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.title.trim()) return { error: "Give the session a title." };
  if (!input.starts_at) return { error: "Pick a start time." };

  const supabase = await createClient();
  const { error } = await supabase.from("program_sessions").insert({
    org_id: ctx.orgId,
    program_id: programId,
    group_id: input.group_id || null,
    title: input.title.trim(),
    location: input.location?.trim() || null,
    starts_at: new Date(input.starts_at).toISOString(),
    ends_at: input.ends_at ? new Date(input.ends_at).toISOString() : null,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export async function markAttendance(
  programId: string,
  sessionId: string,
  participantId: string,
  status: "present" | "absent" | "late",
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("attendance").upsert(
    {
      org_id: ctx.orgId,
      program_id: programId,
      session_id: sessionId,
      participant_id: participantId,
      status,
      marked_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,participant_id" },
  );
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

// Invite a participant's parent to the family view. Creates a parent login,
// attaches it to the org, and links it to the kid so the parent reads only
// their own child's schedule, attendance, and badges. Needs the server key;
// without it the roster still works, just no family login.
export async function inviteParent(programId: string, participantId: string): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { data: kid } = await supabase
    .from("participants")
    .select("id, parent_email, parent_name, parent_user_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!kid) return { error: "That kid was not found." };
  if (kid.parent_user_id) return { error: "This family already has a login." };
  const email = (kid.parent_email as string | null)?.trim();
  if (!email) return { error: "Add the parent's email first." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Inviting a family login needs the server key. Add SUPABASE_SERVICE_ROLE_KEY in the deployment." };
  }

  const parts = ((kid.parent_name as string | null) ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Parent";
  const lastName = parts.slice(1).join(" ");

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });
  if (cErr || !created.user) {
    return { error: "We could not create that login. The email may already be in use." };
  }

  // The signup trigger made a client profile; retarget it to parent in this org.
  await admin
    .from("profiles")
    .update({ org_id: ctx.orgId, role: "parent", first_name: firstName, last_name: lastName })
    .eq("id", created.user.id);

  const { error: linkErr } = await supabase
    .from("participants")
    .update({ parent_user_id: created.user.id, updated_at: new Date().toISOString() })
    .eq("id", participantId);
  if (linkErr) return { error: "Login created, but linking the family failed. Try again." };

  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export async function awardBadge(
  programId: string,
  participantId: string,
  badgeId: string,
  note: string,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("participant_badges").insert({
    org_id: ctx.orgId,
    participant_id: participantId,
    badge_id: badgeId,
    note: note.trim() || null,
    awarded_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

// Record an earned experience for a boy: the same assessment result an adult
// logs, scored the same way by the trigger, but surfaced as encouragement with
// the animal name, never a test he can fail. Staff-only, coach-observed.
export async function recordExperience(
  programId: string,
  participantId: string,
  assessmentId: string,
  value: string,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!participantId || !assessmentId) return { error: "Pick a kid and an experience." };

  const n = Number(value);
  const isNum = value.trim() !== "" && Number.isFinite(n);
  if (!isNum && !value.trim()) return { error: "Enter what he did." };

  const supabase = await createClient();
  const { error } = await supabase.from("assessment_results").insert({
    org_id: ctx.orgId,
    assessment_id: assessmentId,
    subject: "participant",
    participant_id: participantId,
    value: isNum ? n : null,
    value_text: isNum ? null : value.trim(),
    source: "coach_observed",
    recorded_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

// ── Ring 7: family-first intake ──

export type GuardianInput = { first_name: string; last_name: string; email?: string; phone?: string };

// Add a family (guardian). Kids are added under it, family first.
export async function addGuardian(programId: string, input: GuardianInput): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.first_name.trim() || !input.last_name.trim()) return { error: "A family contact needs a name." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .insert({
      org_id: ctx.orgId,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null, id: data.id as string };
}

export type KidInput = {
  first_name: string;
  last_name: string;
  grade?: string;
  group_id?: string;
  guardian_id: string;
};

// Add a kid under an existing family, linking the two. Copies the guardian's
// contact onto the participant for Ring 5 back-compat.
export async function addKidToFamily(programId: string, input: KidInput): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.first_name.trim() || !input.last_name.trim()) return { error: "A first and last name are needed." };
  if (!input.guardian_id) return { error: "Pick a family first." };
  const grade = input.grade ? Number(input.grade) : null;
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 12)) return { error: "Grade is 1 to 12." };

  const supabase = await createClient();
  const { data: g } = await supabase
    .from("guardians")
    .select("first_name, last_name, email, phone, user_id")
    .eq("id", input.guardian_id)
    .single();

  const { data: kid, error } = await supabase
    .from("participants")
    .insert({
      org_id: ctx.orgId,
      program_id: programId,
      group_id: input.group_id || null,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      grade,
      parent_name: g ? `${g.first_name} ${g.last_name}`.trim() : null,
      parent_email: g?.email ?? null,
      parent_phone: g?.phone ?? null,
      parent_user_id: g?.user_id ?? null,
    })
    .select("id")
    .single();
  if (error || !kid) return { error: "That did not save. Try again." };

  const { error: linkErr } = await supabase.from("participant_guardians").insert({
    org_id: ctx.orgId,
    participant_id: kid.id,
    guardian_id: input.guardian_id,
    relationship: "parent",
    is_primary: true,
    can_pickup: true,
  });
  if (linkErr) return { error: "The kid was added, but linking the family failed. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null, id: kid.id as string };
}

export async function setPickup(programId: string, linkId: string, canPickup: boolean): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("participant_guardians")
    .update({ can_pickup: canPickup })
    .eq("id", linkId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export type MedicalInput = {
  allergies?: string;
  conditions?: string;
  medications?: string;
  notes?: string;
  doctor_name?: string;
  doctor_phone?: string;
  insurance_note?: string;
};

export async function upsertMedical(
  programId: string,
  participantId: string,
  input: MedicalInput,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("participant_medical").upsert(
    {
      org_id: ctx.orgId,
      participant_id: participantId,
      allergies: input.allergies?.trim() || null,
      conditions: input.conditions?.trim() || null,
      medications: input.medications?.trim() || null,
      notes: input.notes?.trim() || null,
      doctor_name: input.doctor_name?.trim() || null,
      doctor_phone: input.doctor_phone?.trim() || null,
      insurance_note: input.insurance_note?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "participant_id" },
  );
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

export async function addEmergencyContact(
  programId: string,
  participantId: string,
  input: { name: string; relationship?: string; phone: string },
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim() || !input.phone.trim()) return { error: "A name and phone are needed." };
  const supabase = await createClient();
  const { error } = await supabase.from("emergency_contacts").insert({
    org_id: ctx.orgId,
    participant_id: participantId,
    name: input.name.trim(),
    relationship: input.relationship?.trim() || null,
    phone: input.phone.trim(),
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

// ── Ring 7: forms and the waiver gate ──

export type FormPatch = { title?: string; body?: string; is_required?: boolean; is_active?: boolean };

// Edit a form. A change to the body bumps the version, which clears every
// kid's "signed" state for that form until they sign the new version.
export async function updateForm(programId: string, formId: string, patch: FormPatch): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("forms")
    .select("body, version")
    .eq("id", formId)
    .single();
  if (!current) return { error: "That form was not found." };

  const bodyChanged = patch.body !== undefined && (patch.body.trim() || null) !== current.body;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title.trim() || null;
  if (patch.body !== undefined) update.body = patch.body.trim() || null;
  if (patch.is_required !== undefined) update.is_required = patch.is_required;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  if (bodyChanged) update.version = (current.version as number) + 1;

  const { error } = await supabase.from("forms").update(update).eq("id", formId).eq("org_id", ctx.orgId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

// Record that a family signed a form for a kid (on paper or in person). Signs
// the form's current version; a later version bump re-prompts the family.
export async function acknowledgeForm(
  programId: string,
  formId: string,
  participantId: string,
  signedName: string,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!signedName.trim()) return { error: "Whose signature is this?" };
  const supabase = await createClient();

  const { data: form } = await supabase.from("forms").select("version").eq("id", formId).single();
  if (!form) return { error: "That form was not found." };

  const { data: link } = await supabase
    .from("participant_guardians")
    .select("guardian_id")
    .eq("participant_id", participantId)
    .eq("is_primary", true)
    .maybeSingle();

  const { error } = await supabase.from("form_acknowledgements").upsert(
    {
      org_id: ctx.orgId,
      form_id: formId,
      form_version: form.version as number,
      participant_id: participantId,
      guardian_id: link?.guardian_id ?? null,
      acknowledged_by: ctx.userId,
      signed_name: signedName.trim(),
    },
    { onConflict: "form_id,form_version,participant_id", ignoreDuplicates: true },
  );
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

// ── Ring 7: the enrollment path (tied to Ring 4, not a second ledger) ──

function dollarsToCents(v?: string): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export type EnrollmentInput = {
  offeringId?: string;
  tuition?: string;       // dollars
  scholarship?: string;   // dollars
  scholarshipReason?: string;
  notes?: string;
};

// Create or update a kid's enrollment record. Tuition comes from a Ring 4
// boys_program offering (or a manual figure); a scholarship is a recorded
// discount. This never posts money; enrolling does that (below).
export async function saveEnrollment(
  programId: string,
  participantId: string,
  input: EnrollmentInput,
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("participant_guardians")
    .select("guardian_id")
    .eq("participant_id", participantId)
    .eq("is_primary", true)
    .maybeSingle();

  let tuitionCents = dollarsToCents(input.tuition);
  if (tuitionCents === null && input.offeringId) {
    const { data: off } = await supabase.from("offerings").select("price_cents").eq("id", input.offeringId).maybeSingle();
    tuitionCents = (off?.price_cents as number | null) ?? null;
  }

  const row = {
    org_id: ctx.orgId,
    program_id: programId,
    participant_id: participantId,
    guardian_id: link?.guardian_id ?? null,
    offering_id: input.offeringId || null,
    tuition_cents: tuitionCents,
    scholarship_cents: dollarsToCents(input.scholarship) ?? 0,
    scholarship_reason: input.scholarshipReason?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("program_id", programId)
    .eq("participant_id", participantId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("enrollments").update(row).eq("id", existing.id)
    : await supabase.from("enrollments").insert({ ...row, status: "interested" });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}

// Move an enrollment through the path. On the move into 'enrolled', the owner
// posts the net tuition as one Ring 4 revenue event. A coach can move the
// status but not post revenue (finance is owner-only), so the money waits for
// the owner. Guarded against double-posting by the prior status.
export async function setEnrollmentStatus(
  programId: string,
  enrollmentId: string,
  status: "interested" | "waitlisted" | "offered" | "enrolled" | "withdrawn",
): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();

  const { data: enr } = await supabase
    .from("enrollments")
    .select("id, status, tuition_cents, scholarship_cents, offering_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enr) return { error: "That enrollment was not found." };

  const { error } = await supabase
    .from("enrollments")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", enrollmentId);
  if (error) return { error: "That did not save. Try again." };

  const becomingEnrolled = status === "enrolled" && enr.status !== "enrolled";
  if (becomingEnrolled && ctx.role === "owner") {
    const net = ((enr.tuition_cents as number | null) ?? 0) - ((enr.scholarship_cents as number | null) ?? 0);
    if (net > 0) {
      await supabase.from("revenue_events").insert({
        org_id: ctx.orgId,
        offering_id: (enr.offering_id as string | null) ?? null,
        category: "boys_program",
        description: "Boys program tuition",
        amount_cents: net,
        status: "collected",
        source: "manual",
        entered_by: ctx.userId,
      });
    }
  }
  revalidatePath(`/boys/${programId}`);
  return { error: null };
}
