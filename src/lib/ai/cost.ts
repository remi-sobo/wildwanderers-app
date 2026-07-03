import "server-only";

// Static per-model price map, USD per 1M tokens (list price). Used only for
// the ai_calls cost estimate and the monthly budget stop, so a rough number
// is fine; null when the model id has no known price.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const usd = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Number(usd.toFixed(6));
}
