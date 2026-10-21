import { createClient } from "@/lib/supabase/server";

// The owner's side of advisor access (specs/advisor.md): who advises the
// org, what is shared, and what an advisor sent over. Owner RLS scopes
// every read; an advisor's private work never reaches these queries.

export type AdvisorShareKey = "goals" | "five" | "tasks" | "schedule" | "numbers";

export type AdvisorAccess = {
  advisors: { id: string; advisor_id: string; advisor_name: string; active: boolean; created_at: string }[];
  shares: Partial<Record<AdvisorShareKey, boolean>>;
};

export async function getAdvisorAccess(): Promise<AdvisorAccess> {
  const supabase = await createClient();
  const [{ data: rels }, { data: shares }] = await Promise.all([
    supabase
      .from("advisor_relationships")
      .select("id, advisor_id, advisor_name, active, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("advisor_shares").select("key, enabled"),
  ]);
  const map: AdvisorAccess["shares"] = {};
  for (const s of (shares ?? []) as { key: AdvisorShareKey; enabled: boolean }[]) map[s.key] = s.enabled;
  return { advisors: (rels ?? []) as AdvisorAccess["advisors"], shares: map };
}

export type FromAdvisorTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  kind: "assignment" | "suggestion";
  created_at: string;
  advisor_name: string;
};

// Open suggestions waiting on the owner, and open assignments from the
// last two weeks. Assignments are ordinary tasks too and also show in
// the full list; suggestions show only here until accepted.
export async function getFromAdvisor(): Promise<FromAdvisorTask[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: rows }, { data: rels }] = await Promise.all([
    supabase
      .from("business_tasks")
      .select("id, title, description, due_date, kind, created_at, assigned_by")
      .in("kind", ["assignment", "suggestion"])
      .in("status", ["open", "in_progress"])
      .or(`kind.eq.suggestion,created_at.gte.${since}`)
      .order("created_at", { ascending: false }),
    supabase.from("advisor_relationships").select("advisor_id, advisor_name"),
  ]);
  const names = new Map(
    ((rels ?? []) as { advisor_id: string; advisor_name: string }[]).map((r) => [r.advisor_id, r.advisor_name]),
  );
  return ((rows ?? []) as (Omit<FromAdvisorTask, "advisor_name"> & { assigned_by: string | null })[]).map(
    ({ assigned_by, ...r }) => ({
      ...r,
      advisor_name: (assigned_by && names.get(assigned_by)) || "Your advisor",
    }),
  );
}

export type SharedAdvisorItem = {
  id: string;
  kind: "deliverable" | "question";
  title: string;
  notes: string | null;
  due_date: string | null;
  advisor_name: string;
};

// What an advisor shared that is waiting on the owner: deliverables they
// marked ready, and open questions. Owner RLS returns shared rows only;
// private work never reaches this query. Read only for the owner; each
// clears when the advisor marks it done or delivered.
export async function getSharedAdvisorItems(): Promise<SharedAdvisorItem[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: rels }] = await Promise.all([
    supabase
      .from("advisor_items")
      .select("id, kind, title, notes, due_date, stage, advisor_id")
      .eq("status", "open")
      .or("and(kind.eq.deliverable,stage.eq.ready),kind.eq.question")
      .order("created_at", { ascending: false }),
    supabase.from("advisor_relationships").select("advisor_id, advisor_name"),
  ]);
  const names = new Map(
    ((rels ?? []) as { advisor_id: string; advisor_name: string }[]).map((r) => [r.advisor_id, r.advisor_name]),
  );
  return ((rows ?? []) as (SharedAdvisorItem & { advisor_id: string; stage: string | null })[]).map(
    ({ advisor_id, stage: _stage, ...r }) => ({ ...r, advisor_name: names.get(advisor_id) || "Your advisor" }),
  );
}
