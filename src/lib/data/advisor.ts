import { createClient } from "@/lib/supabase/server";

// The advisor's workspace (specs/advisor.md). Reads only through the
// advisor's own session: advisor_items under RLS, and the definer
// functions advisor_orgs() and advisor_tasks(), which return a masked
// projection of the owner's tasks. Nothing here reads business_tasks
// or any coaching table directly.

export type AdvisorOrg = { org_id: string; org_name: string; owner_first_name: string | null };

export type AdvisorItem = {
  id: string;
  org_id: string;
  kind: "todo" | "deliverable" | "question";
  title: string;
  notes: string | null;
  vis: "private" | "shared";
  stage: "drafting" | "ready" | "shared" | null;
  status: "open" | "done" | "dropped";
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type AdvisorTask = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  due_date: string | null;
  kind: "task" | "assignment" | "suggestion";
  from_me: boolean;
  masked: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type AdvisorWorkspace = {
  org: AdvisorOrg | null;
  items: AdvisorItem[];
  tasks: AdvisorTask[];
  loadFailed: boolean;
};

export async function getAdvisorWorkspace(): Promise<AdvisorWorkspace> {
  const supabase = await createClient();
  const { data: orgs, error: orgErr } = await supabase.rpc("advisor_orgs");
  if (orgErr) return { org: null, items: [], tasks: [], loadFailed: true };
  // One owner per advisor today; the first active relationship leads.
  const org = ((orgs ?? []) as AdvisorOrg[])[0] ?? null;
  if (!org) return { org: null, items: [], tasks: [], loadFailed: false };

  const [{ data: items, error: itemErr }, { data: tasks, error: taskErr }] = await Promise.all([
    supabase
      .from("advisor_items")
      .select("id, org_id, kind, title, notes, vis, stage, status, due_date, created_at, updated_at")
      .eq("org_id", org.org_id)
      .order("created_at", { ascending: false }),
    supabase.rpc("advisor_tasks"),
  ]);

  return {
    org,
    items: (items ?? []) as AdvisorItem[],
    tasks: ((tasks ?? []) as AdvisorTask[])
      .filter((t) => t.org_id === org.org_id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    loadFailed: Boolean(itemErr || taskErr),
  };
}
