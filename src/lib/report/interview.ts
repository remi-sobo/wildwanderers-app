// The guided "Report an issue" interview, forked in process from Trellis and
// retargeted to Wild Wanderers. Pure: no network, no DB, so the prompt shaping
// and the JSON contract stay unit-testable and the server action stays thin.
//
// The flow is a stateless interview: the client owns the transcript and resends
// it each turn. Coach asks one short question at a time (max MAX_QUESTIONS),
// then synthesizes a title plus a paste-ready engineering brief once it has
// enough. The action calls the model with the system prompt this module builds,
// parses the reply with parseInterviewReply, and either asks again or files the
// brief.

export type ReportKind = "bug" | "confusing" | "idea";

export interface InterviewTurn {
  role: "user" | "assistant";
  content: string;
}

export interface PageContext {
  path?: string;
  title?: string;
}

// The model's reply is exactly one of these.
export type InterviewReply =
  | { action: "ask"; message: string }
  | { action: "ready"; title: string; prompt: string };

// Hard cap on follow-up questions. A reporter should never be interviewed to
// death: after this many, the system prompt forces a "ready".
export const MAX_QUESTIONS = 4;

// Cap a synthesized title so it fits a row and an email subject.
export const MAX_TITLE_CHARS = 80;

const KIND_LABEL: Record<ReportKind, string> = {
  bug: "something is broken",
  confusing: "something is confusing",
  idea: "an idea or request",
};

export function isReportKind(v: unknown): v is ReportKind {
  return v === "bug" || v === "confusing" || v === "idea";
}

// How many questions Coach has already asked = the count of its turns so far.
export function questionsAsked(turns: InterviewTurn[]): number {
  return turns.filter((t) => t.role === "assistant").length;
}

// Build the interviewer system prompt. When forceReady (the cap is hit), the
// prompt removes the option to ask and demands a synthesized brief.
export function buildInterviewSystem(opts: {
  kind: ReportKind;
  hasPhoto: boolean;
  pageContext?: PageContext;
  asked: number;
}): string {
  const { kind, hasPhoto, pageContext, asked } = opts;
  const forceReady = asked >= MAX_QUESTIONS;
  const remaining = Math.max(0, MAX_QUESTIONS - asked);

  const where = pageContext?.path
    ? `The reporter opened this from ${pageContext.path}${pageContext.title ? ` ("${pageContext.title}")` : ""}. Treat that as the likely location unless they say otherwise.`
    : "The reporter did not say where in the app they were. Ask if it matters.";

  const photo = hasPhoto
    ? 'The reporter attached a screenshot. Assume it shows the problem, add a "Screenshot: attached" line to the brief, and do not ask them to describe what a screenshot would already show.'
    : "";

  // What a good brief must pin down, by kind.
  const goals =
    kind === "idea"
      ? "the goal, the desired behavior or look, where in the app it belongs, why it matters, and any must-haves or edge cases"
      : "the current (wrong) behavior, the expected behavior, where it happens, the steps to reproduce it, and how often and how bad it is";

  const briefSpec =
    kind === "idea"
      ? [
          "A one-line summary of the request.",
          "Goal: what the person is trying to accomplish.",
          "Desired behavior: what it should do or look like.",
          "Where: the surface or route it belongs on.",
          hasPhoto ? "Screenshot: attached." : null,
          'Acceptance criteria: a short checklist of what "done" means.',
          'End with: "Explore the codebase for the relevant surface, propose the smallest clean implementation, then build it and verify it."',
        ].filter(Boolean)
      : [
          "A one-line summary of the problem.",
          "Observed behavior: what actually happens.",
          "Expected behavior: what should happen instead.",
          "Where: the surface or route it happens on.",
          "Steps to reproduce: numbered, concrete.",
          hasPhoto ? "Screenshot: attached." : null,
          'Acceptance criteria: a short checklist of what "fixed" means.',
          'End with: "Investigate the root cause before changing code, make the smallest correct fix, and verify it."',
        ].filter(Boolean);

  const askOrReady = forceReady
    ? 'You have asked enough questions. Do NOT ask another. Respond with the "ready" JSON now, synthesizing the best brief you can from what you have. If a detail is missing, note it as an open question inside the brief rather than asking.'
    : `You have up to ${remaining} more question${remaining === 1 ? "" : "s"}. Ask ONE short question if it would materially sharpen the brief, otherwise respond with "ready" now. Never re-ask something the reporter already answered.`;

  return [
    `You are the intake guide for the Wild Wanderers coaching app (app.wildwanderers.life), running a "Report an issue" flow. The reporter is telling you about ${KIND_LABEL[kind]}.`,
    "",
    "Your job: with a couple of short, plain-language questions, gather enough to hand an engineer a precise, reproducible brief. You are warm and quick. One question at a time, one sentence, no jargon. Do not ask the reporter anything technical (no file names, no components, no logs).",
    "",
    `For this ${kind === "idea" ? "idea" : "issue"}, aim to pin down: ${goals}.`,
    "",
    where,
    photo,
    "",
    askOrReady,
    "",
    "VOICE: warm, direct, plainspoken, 1-2 sentences. No em dashes, use commas or restructure. No AI-giveaway words (transformative, holistic, leverage, unlock, seamless, robust, pivotal). No emoji, no exclamation marks.",
    "",
    "OUTPUT FORMAT — respond with a SINGLE JSON object and nothing else. Exactly one of:",
    '{"action":"ask","message":"<one short question, in your voice>"}',
    `{"action":"ready","title":"<max ${MAX_TITLE_CHARS} chars, plain summary>","prompt":"<the full engineering brief>"}`,
    "",
    "When you produce the brief (the \"ready\" prompt), write it as a paste-ready instruction for an AI coding agent working on this codebase. Use labeled sections in this order:",
    ...briefSpec.map((s) => `  - ${s}`),
    "",
    "This report is about the Wild Wanderers app (Next.js App Router, Supabase, org-scoped multi-tenant). Name the surface or route in the brief so the engineer starts in the right place.",
    "Never invent file names, component names, or table names, describe the need in plain terms and let the engineer locate the code. Base the brief only on what the reporter told you plus the page context above.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// Parse the model's reply into an InterviewReply, or null when it is unusable.
// Tolerant of stray prose and code fences: strip fences, then slice from the
// first { to the last }. Validates the shape and clamps the title.
export function parseInterviewReply(raw: string): InterviewReply | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  const slice = s.slice(first, last + 1);

  let obj: unknown;
  try {
    obj = JSON.parse(slice);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (o.action === "ask") {
    const message = typeof o.message === "string" ? o.message.trim() : "";
    if (!message) return null;
    return { action: "ask", message };
  }
  if (o.action === "ready") {
    const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
    let title = typeof o.title === "string" ? o.title.trim() : "";
    if (!prompt) return null;
    if (!title) title = prompt.split("\n")[0].slice(0, MAX_TITLE_CHARS);
    if (title.length > MAX_TITLE_CHARS) title = title.slice(0, MAX_TITLE_CHARS).trim();
    return { action: "ready", title, prompt };
  }
  return null;
}

// Default severity we file a report at, before human triage.
export function defaultSeverity(kind: ReportKind): "normal" | "high" {
  return kind === "bug" ? "high" : "normal";
}

// Human label for a kind, for emails and confirmations.
export function kindNoun(kind: ReportKind): string {
  return kind === "bug" ? "Bug" : kind === "confusing" ? "Confusing" : "Idea";
}

export function kindEmoji(kind: ReportKind): string {
  return kind === "bug" ? "🐞" : kind === "confusing" ? "🤔" : "💡";
}
