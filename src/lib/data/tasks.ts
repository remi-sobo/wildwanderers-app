import { createClient } from "@/lib/supabase/server";

// The one task system (specs/unified-tasks.md). Every reader for the /tasks
// surface, the record drawers, and the pipeline's next-step lane lives here.
// RLS scopes everything: the owner sees the org, a coach sees only tasks
// assigned to them or created by them, clients see nothing.

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskRecur = "none" | "daily" | "weekly" | "biweekly" | "monthly";
export type TaskPriority = "urgent" | "high" | "medium" | "low";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: TaskPriority;
  due_date: string | null;
  pin_today: boolean;
  status: TaskStatus;
  lead_id: string | null;
  client_id: string | null;
  customer_id: string | null;
  program_id: string | null;
  assigned_to: string | null;
  is_next_step: boolean;
  recur: TaskRecur;
  source_type: string | null;
  created_at: string;
};

export type TaskLink = {
  kind: "lead" | "client" | "customer" | "program";
  name: string;
  href: string;
};

export type TaskListItem = Task & {
  link: TaskLink | null;
  assigned_name: string | null;
};

export type TaskComment = {
  id: string;
  content: string;
  created_at: string;
  author_name: string | null;
};

export type StaffOption = { id: string; name: string };

const TASK_COLUMNS =
  "id, title, description, category, priority, due_date, pin_today, status, " +
  "lead_id, client_id, customer_id, program_id, assigned_to, is_next_step, recur, source_type, created_at";

type JoinedName = { name?: string | null } | { name?: string | null }[] | null;
type JoinedPerson =
  | { first_name?: string | null; last_name?: string | null }
  | { first_name?: string | null; last_name?: string | null }[]
  | null;

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
function personName(v: JoinedPerson): string | null {
  const p = one(v);
  if (!p) return null;
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null;
}

// Every task the caller can see (RLS decides), newest links resolved to a
// display chip. A coach's task on a lead or customer resolves no name (those
// tables are owner-only); the chip degrades to the bare kind.
export async function getTaskList(): Promise<TaskListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_tasks")
    .select(
      `${TASK_COLUMNS}, leads(name), clients(first_name, last_name), customers(name), programs(name),
       assigned:profiles!business_tasks_assigned_to_fkey(first_name, last_name)`,
    )
    .neq("status", "cancelled")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const row = r as unknown as Task & {
      leads: JoinedName;
      clients: JoinedPerson;
      customers: JoinedName;
      programs: JoinedName;
      assigned: JoinedPerson;
    };
    let link: TaskLink | null = null;
    if (row.lead_id) {
      link = { kind: "lead", name: one(row.leads)?.name ?? "Lead", href: "/business/pipeline" };
    } else if (row.client_id) {
      link = {
        kind: "client",
        name: personName(row.clients) ?? "Client",
        href: `/program/clients/${row.client_id}`,
      };
    } else if (row.customer_id) {
      link = { kind: "customer", name: one(row.customers)?.name ?? "Customer", href: "/business/pipeline" };
    } else if (row.program_id) {
      link = { kind: "program", name: one(row.programs)?.name ?? "Boys program", href: `/boys/${row.program_id}` };
    }
    return {
      ...(row as Task),
      link,
      assigned_name: personName(row.assigned),
    };
  });
}

// All comments the caller can see, grouped per task for the /tasks board
// (RLS trims to visible tasks; the scale is a solo shop, one read is fine).
export async function getAllTaskComments(): Promise<Record<string, TaskComment[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_comments")
    .select("id, task_id, content, created_at, author:profiles!task_comments_created_by_fkey(first_name, last_name)")
    .order("created_at", { ascending: true });
  const byTask: Record<string, TaskComment[]> = {};
  for (const r of data ?? []) {
    (byTask[r.task_id as string] ??= []).push({
      id: r.id as string,
      content: r.content as string,
      created_at: r.created_at as string,
      author_name: personName(r.author as JoinedPerson),
    });
  }
  return byTask;
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_comments")
    .select("id, content, created_at, author:profiles!task_comments_created_by_fkey(first_name, last_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    content: r.content as string,
    created_at: r.created_at as string,
    author_name: personName(r.author as JoinedPerson),
  }));
}

// The assignee picker: the org's staff. Readable by staff via the
// staff_read_org_profiles policy.
export async function getStaffOptions(): Promise<StaffOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("role", ["owner", "coach"])
    .order("role", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name:
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
      (p.role === "owner" ? "Owner" : "Coach"),
  }));
}

// Open tasks attached to one record, for the contextual panels.
export async function getTasksForRecord(
  kind: "client" | "customer" | "program",
  id: string,
): Promise<Task[]> {
  const supabase = await createClient();
  const column = { client: "client_id", customer: "customer_id", program: "program_id" }[kind];
  const { data } = await supabase
    .from("business_tasks")
    .select(TASK_COLUMNS)
    .eq(column, id)
    .neq("status", "cancelled")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data as Task[] | null) ?? [];
}
