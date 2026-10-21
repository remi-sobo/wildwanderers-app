"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

// The advisor's writers (specs/advisor.md). Advisor only, through their
// own session: RLS and the advisor_* functions are the boundary. Every
// create carries a request key generated when the advisor starts writing
// it, so a retry after a weak connection never makes a second row.

export type AdvisorActionResult = { error: string | null };

const SAVE_FAILED = "That did not save. Try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function advisorContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "advisor") return null;
  return { userId: session.userId };
}

function refresh() {
  revalidatePath("/advisor");
}

export type NewAdvisorWork = {
  orgId: string;
  /** private: Me · private. owe: I owe the owner. assign / suggest: to the owner. ask: a question for the owner. */
  mode: "private" | "owe" | "assign" | "suggest" | "ask";
  title: string;
  notes?: string;
  dueDate?: string;
  requestKey: string;
};

export async function addAdvisorWork(input: NewAdvisorWork): Promise<AdvisorActionResult> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  const title = input.title.trim();
  if (!title) return { error: "Write what it is first." };
  if (title.length > 300) return { error: "Keep the title shorter, and put the rest in notes." };
  if (!UUID.test(input.requestKey)) return { error: SAVE_FAILED };
  if (!UUID.test(input.orgId)) return { error: SAVE_FAILED };
  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 5000) return { error: "Keep notes under 5,000 characters." };
  const due = input.dueDate && DATE.test(input.dueDate) ? input.dueDate : null;

  const supabase = await createClient();

  if (input.mode === "assign" || input.mode === "suggest") {
    const { error } = await supabase.rpc("advisor_assign_task", {
      p_org_id: input.orgId,
      p_title: title,
      p_description: notes,
      p_due_date: due,
      p_kind: input.mode === "assign" ? "assignment" : "suggestion",
      p_request_id: input.requestKey,
    });
    if (error) return { error: error.code === "42501" ? "You no longer have access to send work." : SAVE_FAILED };
    refresh();
    return { error: null };
  }

  const row = {
    org_id: input.orgId,
    advisor_id: ctx.userId,
    kind: input.mode === "owe" ? "deliverable" : input.mode === "ask" ? "question" : "todo",
    vis: input.mode === "private" ? "private" : "shared",
    stage: input.mode === "owe" ? "drafting" : null,
    title,
    notes,
    due_date: due,
    request_key: input.requestKey,
  };
  // A repeat of the same request is ignored, never a second row.
  const { error } = await supabase
    .from("advisor_items")
    .upsert(row, { onConflict: "request_key", ignoreDuplicates: true });
  if (error) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

export async function setAdvisorItemStatus(
  id: string,
  status: "open" | "done" | "dropped",
): Promise<AdvisorActionResult> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("advisor_items")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

export async function setDeliverableStage(
  id: string,
  stage: "drafting" | "ready" | "shared",
): Promise<AdvisorActionResult> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("advisor_items")
    .update({ stage })
    .eq("id", id)
    .eq("kind", "deliverable")
    .select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}
