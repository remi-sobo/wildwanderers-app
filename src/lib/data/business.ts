import { createClient } from "@/lib/supabase/server";

export type GoalProgress = {
  id: string;
  name: string;
  metric: "revenue_mtd" | "active_clients" | "open_pipeline_value";
  target_value: number;
  period: string;
  current: number;
};

export type AttentionLead = {
  id: string;
  name: string;
  next_action: string | null;
  next_action_date: string | null;
};

export type BusinessDashboard = {
  activeClients: number;
  revenueMtdCents: number;
  revenueLastMonthCents: number;
  openPipelineCents: number;
  openLeads: number;
  pinnedTasks: number;
  attention: AttentionLead[];
  goals: GoalProgress[];
};

function monthStartUtc(offset = 0): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

// The command dashboard, computed from real rows. Owner RLS scopes every read;
// nothing here is invented, and an empty book reads as zeros with honest empty
// states in the UI.
export async function getBusinessDashboard(): Promise<BusinessDashboard> {
  const supabase = await createClient();
  const startThis = monthStartUtc(0);
  const startLast = monthStartUtc(-1);
  const todayKey = new Date().toISOString().slice(0, 10);

  const [
    { count: activeClients },
    { data: revenue },
    { data: leads },
    { count: pinnedTasks },
    { data: goals },
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("revenue_events")
      .select("amount_cents, occurred_at, status")
      .eq("status", "collected")
      .gte("occurred_at", startLast.toISOString()),
    supabase
      .from("leads")
      .select("id, name, estimated_value_cents, stage, next_action, next_action_date")
      .not("stage", "in", "(won,lost)"),
    supabase
      .from("business_tasks")
      .select("id", { count: "exact", head: true })
      .eq("pin_today", true)
      .in("status", ["open", "in_progress"]),
    supabase.from("business_goals").select("id, name, metric, target_value, period"),
  ]);

  let revenueMtdCents = 0;
  let revenueLastMonthCents = 0;
  for (const r of revenue ?? []) {
    const when = new Date(r.occurred_at as string);
    if (when >= startThis) revenueMtdCents += r.amount_cents as number;
    else if (when >= startLast) revenueLastMonthCents += r.amount_cents as number;
  }

  const openLeadRows = leads ?? [];
  const openPipelineCents = openLeadRows.reduce(
    (sum, l) => sum + ((l.estimated_value_cents as number | null) ?? 0),
    0,
  );
  const attention: AttentionLead[] = openLeadRows
    .filter((l) => l.next_action_date && (l.next_action_date as string) <= todayKey)
    .sort((a, b) => (a.next_action_date as string).localeCompare(b.next_action_date as string))
    .slice(0, 6)
    .map((l) => ({
      id: l.id as string,
      name: l.name as string,
      next_action: (l.next_action as string | null) ?? null,
      next_action_date: (l.next_action_date as string | null) ?? null,
    }));

  const current = {
    revenue_mtd: revenueMtdCents / 100,
    active_clients: activeClients ?? 0,
    open_pipeline_value: openPipelineCents / 100,
  } as const;

  const goalProgress: GoalProgress[] = (goals ?? []).map((g) => ({
    id: g.id as string,
    name: g.name as string,
    metric: g.metric as GoalProgress["metric"],
    target_value: Number(g.target_value),
    period: g.period as string,
    current: current[g.metric as keyof typeof current] ?? 0,
  }));

  return {
    activeClients: activeClients ?? 0,
    revenueMtdCents,
    revenueLastMonthCents,
    openPipelineCents,
    openLeads: openLeadRows.length,
    pinnedTasks: pinnedTasks ?? 0,
    attention,
    goals: goalProgress,
  };
}

// Shared money formatter for the business surfaces.
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
