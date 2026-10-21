import { createClient } from "@/lib/supabase/server";

// The Business launchpad's live lines (owner HQ layout). Counts and next
// dates only, all from real rows through the owner's own session; RLS
// scopes every read. Dates come back raw so the page can judge "today"
// on the owner's device, the same way the Schedule grid does.

export type ComingUp =
  | { kind: "popup"; id: string; starts_at: string; location: string | null }
  | {
      kind: "program";
      program_id: string;
      program_name: string;
      title: string;
      starts_at: string;
      location: string | null;
    };

export type BusinessHomeData = {
  draftsToReview: number;
  newInquiries: number;
  /** due_date of each open lead next step. */
  followUpDues: string[];
  /** due_date of each open, dated task. */
  taskDues: string[];
  nextPopup: Extract<ComingUp, { kind: "popup" }> | null;
  nextProgramSession: Extract<ComingUp, { kind: "program" }> | null;
};

export async function getBusinessHome(): Promise<BusinessHomeData> {
  const supabase = await createClient();
  const now = new Date();
  // A pop-up that started a few hours ago is still today's pop-up.
  const popupSince = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

  const [drafts, inquiries, steps, tasks, popup, session] = await Promise.all([
    // Same filter as the drafts inbox (getDraftsAcrossClients).
    supabase
      .from("training_plans")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "pending_review"])
      .or("initiated_by.neq.client,status.eq.pending_review"),
    supabase.from("lead_inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("business_tasks")
      .select("due_date")
      .eq("is_next_step", true)
      .in("status", ["open", "in_progress"])
      .not("due_date", "is", null),
    supabase
      .from("business_tasks")
      .select("due_date")
      .in("status", ["open", "in_progress"])
      .not("due_date", "is", null),
    supabase
      .from("popup_days")
      .select("id, starts_at, location")
      .gte("starts_at", popupSince)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("program_sessions")
      .select("program_id, title, starts_at, location, programs(name)")
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const dues = (rows: { due_date: string | null }[] | null) =>
    (rows ?? []).map((r) => r.due_date).filter((d): d is string => Boolean(d));

  const programRel = session.data?.programs as { name?: string } | { name?: string }[] | null | undefined;
  const programName = (Array.isArray(programRel) ? programRel[0]?.name : programRel?.name) ?? "Boys program";

  return {
    draftsToReview: drafts.count ?? 0,
    newInquiries: inquiries.count ?? 0,
    followUpDues: dues(steps.data as { due_date: string | null }[] | null),
    taskDues: dues(tasks.data as { due_date: string | null }[] | null),
    nextPopup: popup.data
      ? {
          kind: "popup",
          id: popup.data.id as string,
          starts_at: popup.data.starts_at as string,
          location: (popup.data.location as string | null) ?? null,
        }
      : null,
    nextProgramSession: session.data
      ? {
          kind: "program",
          program_id: session.data.program_id as string,
          program_name: programName,
          title: session.data.title as string,
          starts_at: session.data.starts_at as string,
          location: (session.data.location as string | null) ?? null,
        }
      : null,
  };
}
