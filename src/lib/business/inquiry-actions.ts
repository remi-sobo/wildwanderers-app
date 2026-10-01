"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { auditLog } from "@/lib/audit/log";
import type { BizResult } from "@/lib/business/actions";

// Accept and dismiss for website inquiries (speed to lead). Owner-only, the
// same as every lead write; RLS enforces it again at the database.

const FIRST_STEP = "Send the first reply and offer the free consult";

async function ownerContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "owner" || !session.profile.org_id) return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function revalidate() {
  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  revalidatePath("/tasks");
}

// One tap: the inquiry becomes a lead (source website, stage new) with its
// next-step task due today and a timeline entry. The inquiry is claimed
// first (new -> accepted), so a double tap or a second tab cannot make two
// leads; if the lead insert fails the claim is released.
export async function acceptInquiry(inquiryId: string): Promise<BizResult & { leadId?: string }> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { data: inq } = await supabase
    .from("lead_inquiries")
    .update({ status: "accepted" })
    .eq("id", inquiryId)
    .eq("status", "new")
    .select("id, org_id, name, email, phone, interest, message, preferred_times")
    .maybeSingle();
  if (!inq) return { error: "That inquiry was already handled." };

  // Their words ride on the lead's notes, where Gabe reads the lead.
  const times = (inq.preferred_times as string[] | null) ?? [];
  const notes =
    [
      inq.message ? `From the website form: ${inq.message}` : null,
      times.length ? `Usually free: ${times.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      org_id: inq.org_id,
      name: inq.name,
      email: inq.email,
      phone: inq.phone,
      source: "website",
      stage: "new",
      interest: inq.interest,
      notes,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (leadErr || !lead) {
    await supabase.from("lead_inquiries").update({ status: "new" }).eq("id", inq.id);
    return { error: "That did not save. Try again." };
  }

  await Promise.all([
    supabase.from("lead_inquiries").update({ accepted_lead_id: lead.id }).eq("id", inq.id),
    supabase.from("lead_activities").insert({
      org_id: inq.org_id,
      lead_id: lead.id,
      kind: "note",
      content: "Website inquiry accepted",
      created_by: ctx.userId,
    }),
    supabase.from("business_tasks").insert({
      org_id: inq.org_id,
      title: FIRST_STEP,
      category: "sales",
      priority: "high",
      // UTC day key, the same "today" the dashboard's due list reads.
      due_date: new Date().toISOString().slice(0, 10),
      lead_id: lead.id,
      is_next_step: true,
      assigned_to: ctx.userId,
      created_by: ctx.userId,
    }),
  ]);

  void auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: "lead_inquiry.accept",
    entityTable: "lead_inquiries",
    entityId: inq.id,
    metadata: { lead_id: lead.id },
  });

  revalidate();
  return { error: null, leadId: lead.id };
}

// Spam or not a fit: off the inbox, no lead, nothing on the board.
export async function dismissInquiry(inquiryId: string): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_inquiries")
    .update({ status: "dismissed" })
    .eq("id", inquiryId)
    .eq("status", "new")
    .select("id")
    .maybeSingle();
  if (!data) return { error: "That inquiry was already handled." };

  void auditLog({
    actorId: ctx.userId,
    orgId: ctx.orgId,
    action: "lead_inquiry.dismiss",
    entityTable: "lead_inquiries",
    entityId: inquiryId,
  });

  revalidate();
  return { error: null };
}
