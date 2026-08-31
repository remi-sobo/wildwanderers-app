import { createClient } from "@/lib/supabase/server";

// Readers for client homework, the extra mile beside the training plan:
// one-off, checkable, personal. RLS scopes everything: staff read the
// org, a client reads only their own rows. Completion notes are the
// client's own words; treat them like messages, and no AI touches them.

export type HomeworkStatus = "assigned" | "done";

export type Homework = {
  id: string;
  client_id: string;
  title: string;
  details_md: string | null;
  due_date: string | null;
  status: HomeworkStatus;
  assigned_at: string;
  completed_at: string | null;
  completion_note: string | null;
};

const HOMEWORK_COLUMNS =
  "id, client_id, title, details_md, due_date, status, assigned_at, completed_at, completion_note";

// One client's homework for the coach view: open first, then done,
// newest assignment first within each.
export async function getHomeworkForClient(clientId: string): Promise<Homework[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_homework")
    .select(HOMEWORK_COLUMNS)
    .eq("client_id", clientId)
    .order("status", { ascending: true })
    .order("assigned_at", { ascending: false });
  return (data as Homework[] | null) ?? [];
}

// The signed-in client's own homework, same shape and order. RLS trims
// to their rows; the empty list is a rest day, not an error.
export async function getMyHomework(): Promise<Homework[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_homework")
    .select(HOMEWORK_COLUMNS)
    .order("status", { ascending: true })
    .order("assigned_at", { ascending: false });
  return (data as Homework[] | null) ?? [];
}
