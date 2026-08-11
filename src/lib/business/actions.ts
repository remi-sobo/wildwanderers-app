"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import type { LeadStage } from "@/lib/data/business";

export type BizResult = { error: string | null };

async function ownerContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "owner" || !session.profile.org_id) return null;
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

// The next action lives as the lead's next-step task, not a lead column;
// the add form's next-action inputs become that task on create.
export async function addLead(input: LeadInput): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim()) return { error: "A name is needed." };

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      org_id: ctx.orgId,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source || "other",
      interest: input.interest || null,
      estimated_value_cents: dollarsToCents(input.estimated_value),
      notes: input.notes?.trim() || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !lead) return { error: "That did not save. Try again." };

  if (input.next_action?.trim() || input.next_action_date) {
    await supabase.from("business_tasks").insert({
      org_id: ctx.orgId,
      title: input.next_action?.trim() || "Follow up",
      category: "sales",
      priority: "medium",
      due_date: input.next_action_date || null,
      lead_id: lead.id,
      is_next_step: true,
      assigned_to: ctx.userId,
      created_by: ctx.userId,
    });
  }

  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  revalidatePath("/tasks");
  return { error: null };
}

// A closed lead needs no next step.
async function cancelOpenNextStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
) {
  await supabase
    .from("business_tasks")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("is_next_step", true)
    .in("status", ["open", "in_progress"]);
}

// Edit the lead's details from the popout. Only the fields the form owns;
// stage moves stay with moveLeadStage so the timeline entry never gets lost.
export async function updateLead(leadId: string, input: LeadInput & { notes?: string }): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim()) return { error: "A name is needed." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source || "other",
      interest: input.interest || null,
      estimated_value_cents: dollarsToCents(input.estimated_value),
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  return { error: null };
}

// Mark a lead lost with the reason, and keep the why on the timeline.
export async function markLeadLost(leadId: string, reason: string): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      stage: "lost",
      lost_reason: reason.trim() || null,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) return { error: "That did not save. Try again." };
  await cancelOpenNextStep(supabase, leadId);

  await supabase.from("lead_activities").insert({
    org_id: ctx.orgId,
    lead_id: leadId,
    kind: "stage_change",
    content: reason.trim() ? `Marked lost: ${reason.trim()}` : "Marked lost",
    created_by: ctx.userId,
  });

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
  if (terminal) await cancelOpenNextStep(supabase, leadId);

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

// Task writes moved to @/lib/tasks/actions with the unified task system.

export type GoalInput = {
  name: string;
  metric: string;
  target_value: string;
  period: string;
};

export async function addGoal(input: GoalInput): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim()) return { error: "A name is needed." };
  const target = Number(input.target_value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(target) || target <= 0) return { error: "Set a target above zero." };
  if (!/^\d{4}(-\d{2})?$/.test(input.period)) return { error: "Period looks like 2026-07 or 2026." };

  const supabase = await createClient();
  const { error } = await supabase.from("business_goals").insert({
    org_id: ctx.orgId,
    name: input.name.trim(),
    metric: input.metric,
    target_value: target,
    period: input.period,
    set_by: ctx.userId,
  });
  if (error) return { error: "That did not save. A goal for that metric and period may already exist." };
  revalidatePath("/business/tasks");
  revalidatePath("/business");
  return { error: null };
}

export async function deleteGoal(goalId: string): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("business_goals").delete().eq("id", goalId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/business/tasks");
  revalidatePath("/business");
  return { error: null };
}

export type RevenueInput = {
  amount: string;
  category: string;
  description?: string;
  customer_id?: string;
  offering_id?: string;
  occurred_at?: string;
};

export async function addRevenue(input: RevenueInput): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const cents = dollarsToCents(input.amount);
  if (cents === null || cents <= 0) return { error: "Enter an amount." };

  const supabase = await createClient();
  const { error } = await supabase.from("revenue_events").insert({
    org_id: ctx.orgId,
    category: input.category || "other",
    description: input.description?.trim() || null,
    amount_cents: cents,
    customer_id: input.customer_id || null,
    offering_id: input.offering_id || null,
    status: "collected",
    source: "manual",
    occurred_at: input.occurred_at ? new Date(input.occurred_at).toISOString() : new Date().toISOString(),
    entered_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };

  // Roll the customer's lifetime value if attributed.
  if (input.customer_id) {
    const { data: sums } = await supabase
      .from("revenue_events")
      .select("amount_cents")
      .eq("customer_id", input.customer_id)
      .eq("status", "collected");
    const ltv = (sums ?? []).reduce((s, r) => s + (r.amount_cents as number), 0);
    await supabase.from("customers").update({ lifetime_value_cents: ltv }).eq("id", input.customer_id);
  }

  revalidatePath("/business/finance");
  revalidatePath("/business");
  return { error: null };
}

export type ExpenseInput = {
  amount: string;
  category: string;
  vendor?: string;
  description?: string;
  expense_date?: string;
  recurring?: boolean;
};

export async function addExpense(input: ExpenseInput): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const cents = dollarsToCents(input.amount);
  if (cents === null || cents <= 0) return { error: "Enter an amount." };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    org_id: ctx.orgId,
    category: input.category || "other",
    vendor: input.vendor?.trim() || null,
    description: input.description?.trim() || null,
    amount_cents: cents,
    expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
    recurring: Boolean(input.recurring),
    entered_by: ctx.userId,
  });
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/business/finance");
  return { error: null };
}

export async function setOfferingPrice(offeringId: string, priceDollars: string): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const cents = dollarsToCents(priceDollars);

  const supabase = await createClient();
  const { error } = await supabase.from("offerings").update({ price_cents: cents }).eq("id", offeringId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/business/finance");
  return { error: null };
}

export async function toggleOffering(offeringId: string, isActive: boolean): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase.from("offerings").update({ is_active: isActive }).eq("id", offeringId);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/business/finance");
  return { error: null };
}

function splitName(full: string): { first: string; last: string } {
  const [first, ...rest] = full.trim().split(/\s+/);
  return { first: first || "Client", last: rest.join(" ") };
}

// Create the Program roster record for a customer and link it back. The
// bridge between the CRM and the coaching side: a customer without a linked
// client is invisible to Program, the plan builder, and the active-clients
// metric. Login setup stays a separate step on the client's page.
async function createLinkedClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  customerId: string,
  fullName: string,
): Promise<string | null> {
  const { first, last } = splitName(fullName);
  const { data: clientRow } = await supabase
    .from("clients")
    .insert({ org_id: orgId, first_name: first, last_name: last, status: "active" })
    .select("id")
    .single();
  if (!clientRow) return null;
  await supabase.from("customers").update({ client_id: clientRow.id }).eq("id", customerId);
  return clientRow.id as string;
}

// Convert a lead into a customer: create the customer record, put them on the
// Program roster (boys program families excepted, they enroll through Dads &
// Kids), link everything, and mark the lead won. Skips if already linked.
export async function convertLeadToCustomer(leadId: string): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, phone, source, interest, customer_id")
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

  if (lead.interest !== "boys_program") {
    const clientId = await createLinkedClient(supabase, ctx.orgId, customer.id as string, lead.name as string);
    if (!clientId) {
      return { error: "The customer was created but adding them to Program failed. Use Add to roster on the customer row." };
    }
  }

  await supabase
    .from("leads")
    .update({
      customer_id: customer.id,
      stage: "won",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  await cancelOpenNextStep(supabase, leadId);

  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  revalidatePath("/program");
  return { error: null };
}

// The catch-up for customers converted before the bridge existed, and for
// boys program families Gabe decides belong on the roster after all.
export async function addCustomerToRoster(customerId: string): Promise<BizResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, client_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: "That customer was not found." };
  if (customer.client_id) return { error: "They are already on the Program roster." };

  const clientId = await createLinkedClient(supabase, ctx.orgId, customer.id as string, customer.name as string);
  if (!clientId) return { error: "That did not save. Try again." };

  revalidatePath("/business/pipeline");
  revalidatePath("/business");
  revalidatePath("/program");
  return { error: null };
}
