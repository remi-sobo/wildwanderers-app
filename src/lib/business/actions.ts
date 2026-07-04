"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import type { LeadStage } from "@/lib/data/business";

export type BizResult = { error: string | null };

async function ownerContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "owner") return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function dollarsToCents(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export type LeadInput = {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  interest?: string;
  estimated_value?: string;
  next_action?: string;
  next_action_date?: string;
  notes?: string;
};

export async function addLead(input: LeadInput): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim()) return { error: "A name is needed." };

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    org_id: ctx.orgId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    source: input.source || "other",
    interest: input.interest || null,
    estimated_value_cents: dollarsToCents(input.estimated_value),
    next_action: input.next_action?.trim() || null,
    next_action_date: input.next_action_date || null,
    notes: input.notes?.trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  return { error: null };
}

export async function moveLeadStage(leadId: string, stage: LeadStage): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const terminal = stage === "won" || stage === "lost";
  const { error } = await supabase
    .from("leads")
    .update({
      stage,
      closed_at: terminal ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) return { error: "That did not save. Try again." };

  await supabase.from("lead_activities").insert({
    org_id: ctx.orgId,
    lead_id: leadId,
    kind: "stage_change",
    content: `Moved to ${stage}`,
    created_by: ctx.userId,
  });

  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  return { error: null };
}

export async function logLeadActivity(
  leadId: string,
  kind: string,
  content: string,
): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  if (!content.trim()) return { error: "Add a note first." };

  const supabase = await createClient();
  const { error } = await supabase.from("lead_activities").insert({
    org_id: ctx.orgId,
    lead_id: leadId,
    kind,
    content: content.trim(),
    created_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/business/pipeline");
  return { error: null };
}

// Convert a lead into a customer: create the customer record, link it, and mark
// the lead won. Skips if the lead is already linked.
export async function convertLeadToCustomer(leadId: string): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, phone, source, customer_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { error: "That lead was not found." };
  if (lead.customer_id) return { error: "This lead is already a customer." };

  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .insert({
      org_id: ctx.orgId,
      name: lead.name,
      email: (lead.email as string | null) || null,
      phone: (lead.phone as string | null) || null,
      lifecycle_stage: "active",
      first_touch_source: lead.source,
    })
    .select("id")
    .single();
  if (cErr || !customer) return { error: "Could not create the customer. Check for a duplicate email." };

  await supabase
    .from("leads")
    .update({
      customer_id: customer.id,
      stage: "won",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  return { error: null };
}
