import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthlyBudgetUsd } from "@/lib/ai/config";

// Month-to-date AI spend, summed from the sealed ai_calls ledger through the
// admin chokepoint (the ledger is service-role only). Best-effort: if the read
// fails we treat spend as unknown-but-zero so a transient error never blocks
// Coach, and the per-call estimate still accrues going forward.
export async function monthToDateSpendUsd(): Promise<number> {
  try {
    const admin = createAdminClient();
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { data } = await admin
      .from("ai_calls")
      .select("cost_usd")
      .gte("created_at", start.toISOString());
    return (data ?? []).reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0);
  } catch {
    return 0;
  }
}

export type BudgetState = { spent: number; cap: number; remaining: number; ok: boolean };

export async function budgetState(): Promise<BudgetState> {
  const cap = monthlyBudgetUsd();
  const spent = await monthToDateSpendUsd();
  const remaining = Math.max(0, cap - spent);
  return { spent, cap, remaining, ok: spent < cap };
}
