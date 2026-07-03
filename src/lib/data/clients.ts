import { createClient } from "@/lib/supabase/server";

export type ClientStatus = "active" | "paused" | "archived";

export type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  goal: string | null;
  status: ClientStatus;
  user_id: string | null;
};

export type ClientListItem = ClientRow & {
  active_plan_title: string | null;
};

// Every client in the coach's org, with the title of their active plan if any.
// RLS scopes this to the org automatically.
export async function getClients(): Promise<ClientListItem[]> {
  const supabase = await createClient();

  const [{ data: clients }, { data: plans }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, first_name, last_name, goal, status, user_id")
      .order("created_at", { ascending: true }),
    supabase.from("training_plans").select("client_id, title").eq("status", "active"),
  ]);

  const activeByClient = new Map(
    (plans ?? []).map((p) => [p.client_id as string, p.title as string]),
  );

  return (clients ?? []).map((c) => ({
    ...(c as ClientRow),
    active_plan_title: activeByClient.get(c.id as string) ?? null,
  }));
}

export async function getClientById(id: string): Promise<ClientRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, goal, status, user_id")
    .eq("id", id)
    .maybeSingle();
  return (data as ClientRow | null) ?? null;
}

export function clientName(c: { first_name: string; last_name: string }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Client";
}
