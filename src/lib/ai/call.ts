import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { coachConfigured } from "@/lib/ai/config";
import { estimateCostUsd } from "@/lib/ai/cost";
import { budgetState } from "@/lib/ai/budget";
import { violatesVoice, voiceRetryNote, type VoiceViolation } from "@/lib/voice/sweep";

// Typed failures the server actions map to friendly copy.
export class CoachNotConfiguredError extends Error {
  constructor() {
    super("Scout is not set up yet.");
    this.name = "CoachNotConfiguredError";
  }
}
export class CoachBudgetError extends Error {
  constructor() {
    super("Scout has reached this month's usage limit.");
    this.name = "CoachBudgetError";
  }
}

type Msg = { role: "user" | "assistant"; content: string };

// Log one call to the sealed ai_calls ledger, fire-and-forget. Never blocks or
// throws into the caller.
async function logCall(row: {
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  actorId: string | null;
  orgId: string | null;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("ai_calls").insert({
      task: row.task,
      model: row.model,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      cost_usd: estimateCostUsd(row.model, row.inputTokens, row.outputTokens),
      actor_id: row.actorId,
      org_id: row.orgId,
    });
  } catch {
    // best-effort
  }
}

async function logVoice(row: {
  source: string;
  violations: VoiceViolation[];
  raw: string;
  cleaned: string | null;
  retried: boolean;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("voice_violations").insert({
      source: row.source,
      violations: row.violations,
      raw_excerpt: row.raw.slice(0, 200),
      cleaned_excerpt: row.cleaned?.slice(0, 200) ?? null,
      retried: row.retried,
    });
  } catch {
    // best-effort
  }
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Gate every call: Coach must be configured and under the monthly budget.
async function gate() {
  if (!coachConfigured()) throw new CoachNotConfiguredError();
  const budget = await budgetState();
  if (!budget.ok) throw new CoachBudgetError();
}

export type CoachContext = { actorId: string | null; orgId: string | null };

// A plain-text Coach reply (summaries, nudges), voice-swept with one retry.
export async function callCoachText(opts: {
  task: string;
  model: string;
  system: string;
  messages: Msg[];
  maxTokens?: number;
  context: CoachContext;
}): Promise<string> {
  await gate();
  const anthropic = client();
  const maxTokens = opts.maxTokens ?? 1500;

  const first = await anthropic.messages.create({
    model: opts.model,
    max_tokens: maxTokens,
    system: opts.system,
    messages: opts.messages,
  });
  await logCall({
    task: opts.task,
    model: opts.model,
    inputTokens: first.usage.input_tokens,
    outputTokens: first.usage.output_tokens,
    actorId: opts.context.actorId,
    orgId: opts.context.orgId,
  });

  const firstText = textOf(first);
  const violations = violatesVoice(firstText);
  if (violations.length === 0) return firstText;

  // One corrective retry.
  const retry = await anthropic.messages.create({
    model: opts.model,
    max_tokens: maxTokens,
    system: opts.system,
    messages: [
      ...opts.messages,
      { role: "assistant", content: firstText },
      { role: "user", content: voiceRetryNote(violations) },
    ],
  });
  await logCall({
    task: `${opts.task}.retry`,
    model: opts.model,
    inputTokens: retry.usage.input_tokens,
    outputTokens: retry.usage.output_tokens,
    actorId: opts.context.actorId,
    orgId: opts.context.orgId,
  });

  const retryText = textOf(retry);
  await logVoice({
    source: opts.task,
    violations,
    raw: firstText,
    cleaned: retryText,
    retried: true,
  });
  return retryText;
}

// A raw Coach reply that is NOT voice-swept. Used by the "Report an issue"
// intake, where the synthesized artifact is an engineering brief (a technical
// document), not client-facing prose, so the voice sweep would wrongly rewrite
// it. Still gated by config and budget, and still logged to the ai_calls ledger.
export async function callCoachRaw(opts: {
  task: string;
  model: string;
  system: string;
  messages: Msg[];
  maxTokens?: number;
  context: CoachContext;
}): Promise<string> {
  await gate();
  const anthropic = client();
  const res = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system,
    messages: opts.messages,
  });
  await logCall({
    task: opts.task,
    model: opts.model,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    actorId: opts.context.actorId,
    orgId: opts.context.orgId,
  });
  return textOf(res);
}

// A structured Coach reply (a workout draft). Forced tool use guarantees the
// model returns the schema as validated JSON rather than prose we parse.
// Thinking is off because the API does not allow it with a forced tool choice.
// The serialized JSON is voice-swept; a trip logs and retries once.
export async function callCoachStructured<T>(opts: {
  task: string;
  model: string;
  system: string;
  messages: Msg[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  context: CoachContext;
}): Promise<T> {
  await gate();
  const anthropic = client();
  const maxTokens = opts.maxTokens ?? 4000;

  const tool: Anthropic.Tool = {
    name: "submit",
    description: "Return the result using exactly this structure.",
    input_schema: opts.schema as Anthropic.Tool.InputSchema,
  };

  async function run(messages: Msg[], taskLabel: string): Promise<{ raw: string; parsed: T }> {
    const res = await anthropic.messages.create({
      model: opts.model,
      max_tokens: maxTokens,
      thinking: { type: "disabled" },
      system: opts.system,
      messages,
      tools: [tool],
      tool_choice: { type: "tool", name: "submit" },
    });
    await logCall({
      task: taskLabel,
      model: opts.model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      actorId: opts.context.actorId,
      orgId: opts.context.orgId,
    });
    const block = res.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!block) throw new Error("Scout returned no draft.");
    return { raw: JSON.stringify(block.input), parsed: block.input as T };
  }

  const first = await run(opts.messages, opts.task);
  const violations = violatesVoice(first.raw);
  if (violations.length === 0) return first.parsed;

  const retry = await run(
    [
      ...opts.messages,
      { role: "assistant", content: `Previous draft: ${first.raw}` },
      { role: "user", content: voiceRetryNote(violations) },
    ],
    `${opts.task}.retry`,
  );
  await logVoice({
    source: opts.task,
    violations,
    raw: first.raw,
    cleaned: retry.raw,
    retried: true,
  });
  return retry.parsed;
}
