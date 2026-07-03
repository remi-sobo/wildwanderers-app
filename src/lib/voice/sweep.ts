// The Wild Wanderers voice rules (CLAUDE.md), enforced on every string Coach
// generates. Anything this catches is logged to voice_violations and the call
// is retried once with a corrective note. Pure and dependency-free so it can
// run in any context.

// The AI-giveaway words we never ship, and their family.
const BANNED_WORDS = [
  "transformative",
  "holistic",
  "leverage",
  "unlock",
  "seamless",
  "seamlessly",
  "robust",
  "pivotal",
  "elevate",
  "empower",
  "unleash",
  "harness",
  "delve",
  "realm",
  "tapestry",
  "testament",
  "landscape",
  "synergy",
];

// Words that frame a client as broken. A wellness app never does this.
const BROKEN_WORDS = ["broken", "unhealthy", "failing", "failure", "lazy", "overweight"];

export type VoiceViolation = "em_dash" | "banned_word" | "broken_framing";

export function violatesVoice(text: string): VoiceViolation[] {
  const found = new Set<VoiceViolation>();
  const lower = text.toLowerCase();

  // No em dashes (or the unspaced double hyphen that stands in for one).
  if (text.includes("—") || /\w--\w/.test(text)) {
    found.add("em_dash");
  }

  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`, "i").test(lower)) {
      found.add("banned_word");
      break;
    }
  }

  for (const w of BROKEN_WORDS) {
    if (new RegExp(`\\b${w}\\b`, "i").test(lower)) {
      found.add("broken_framing");
      break;
    }
  }

  return [...found];
}

// A short note appended to the prompt on a retry, naming what tripped.
export function voiceRetryNote(violations: VoiceViolation[]): string {
  const parts: string[] = [];
  if (violations.includes("em_dash")) parts.push("no em dashes (use commas or restructure)");
  if (violations.includes("banned_word"))
    parts.push("no AI-giveaway words like transformative, leverage, unlock, seamless, robust");
  if (violations.includes("broken_framing"))
    parts.push("never frame the client as broken, unhealthy, or failing; the plan needs work, not the person");
  return `Your previous draft broke the voice rules: ${parts.join("; ")}. Rewrite it cleanly, keeping the substance.`;
}
