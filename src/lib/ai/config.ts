import "server-only";

// Coach's model tiers (decision 1, locked): Sonnet 5 drafts workouts, Haiku
// 4.5 handles the lighter summaries and check-in structuring.
export const DRAFT_MODEL = "claude-sonnet-5";
export const SUMMARY_MODEL = "claude-haiku-4-5";

// The monthly spend stop (AI_MONTHLY_BUDGET_USD, default 25). The budget check
// sums ai_calls for the current month before every call.
export function monthlyBudgetUsd(): number {
  const raw = Number(process.env.AI_MONTHLY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 25;
}

// Coach is off until a key is set. Everything degrades to a friendly
// "not configured yet" state; nothing else in the app is affected.
export function coachConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
