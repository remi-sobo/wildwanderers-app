// Pure pieces of advisor Calls (specs/advisor-calls.md): stable item
// keys, matching proposals against existing work, the "what the owner
// will see" preview, and the next-call agenda. No server imports; unit
// tested.

export type CallSection = "owner" | "advisor" | "decided" | "note";
export type CallOwner = "owner" | "advisor" | "unclear";
export type CallFlag = "already_in_app" | "possibly_done" | "needs_clarification" | "idea" | "goal";
export type CallItemState = "proposed" | "accepted" | "removed" | "sent";

export type CallItem = {
  id: string;
  section: CallSection;
  text: string;
  owner: CallOwner;
  due_date: string | null;
  quote: string | null;
  quote_at: string | null;
  flag: CallFlag | null;
  match_task_id: string | null;
  state: CallItemState;
  send_as: "assignment" | "suggestion" | null;
  keep_private: boolean;
  sent_task_id: string | null;
};

const STOP = new Set([
  "a", "an", "the", "to", "for", "of", "and", "or", "on", "in", "at", "with", "by", "about",
  "is", "be", "it", "this", "that", "his", "her", "their", "our", "my", "your",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

/** FNV-1a, 32-bit: a short stable fingerprint, not a security hash. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The same proposal from the same call always gets the same key. */
export function itemKey(section: CallSection, text: string): string {
  return `${section}:${fnv1a(normalize(text))}`;
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter(Boolean));
}

/** Word overlap between two phrases, 0 to 1. */
export function similarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}

export type MatchCandidate = { id: string; title: string; done: boolean; masked: boolean };

export const MATCH_THRESHOLD = 0.6;

/**
 * Compares a proposal with open and finished work. A close match to open
 * work is "already in the app" and links to it; a close match to finished
 * work is "possibly done". Masked tasks have no usable title and never
 * match.
 */
export function matchProposal(
  text: string,
  candidates: MatchCandidate[],
): { flag: "already_in_app" | "possibly_done"; matchId: string } | null {
  let best: { c: MatchCandidate; s: number } | null = null;
  for (const c of candidates) {
    if (c.masked) continue;
    const s = similarity(text, c.title);
    if (s >= MATCH_THRESHOLD && (!best || s > best.s)) best = { c, s };
  }
  if (!best) return null;
  return { flag: best.c.done ? "possibly_done" : "already_in_app", matchId: best.c.id };
}

/** What a send will do: what the owner sees, and what is held back. */
export function sendPreview(items: CallItem[]): {
  toOwner: CallItem[];
  toMe: CallItem[];
  onRecord: CallItem[];
  linked: CallItem[];
  held: CallItem[];
} {
  const accepted = items.filter((i) => i.state === "accepted");
  // Same order as advisor_send_call(): an unclear owner holds an item
  // back even if it matches existing work.
  const held = accepted.filter(
    (i) =>
      i.section === "owner" &&
      (i.owner === "unclear" || (!i.match_task_id && !i.keep_private && i.owner === "owner" && !i.send_as)),
  );
  const heldIds = new Set(held.map((i) => i.id));
  const rest = accepted.filter((i) => !heldIds.has(i.id));
  return {
    toOwner: rest.filter((i) => !i.match_task_id && i.section === "owner" && i.owner === "owner" && !i.keep_private),
    toMe: rest.filter(
      (i) => !i.match_task_id && (i.section === "advisor" || (i.section === "owner" && (i.keep_private || i.owner === "advisor"))),
    ),
    onRecord: rest.filter((i) => !i.match_task_id && (i.section === "decided" || i.section === "note")),
    linked: rest.filter((i) => Boolean(i.match_task_id)),
    held,
  };
}

type AgendaTask = { title: string; status: string; kind: string; from_me: boolean; masked: boolean; completed_at: string | null };
type AgendaItem = { title: string; kind: string; status: string; stage: string | null };

/**
 * A plain-text agenda for the next call, built from real work: what got
 * finished since the last call, what is still open, what the advisor is
 * waiting on, and what they owe. Editable before it is saved.
 */
export function buildAgenda(opts: {
  ownerName: string;
  lastCallOn: string | null;
  tasks: AgendaTask[];
  items: AgendaItem[];
}): string {
  const { ownerName, lastCallOn } = opts;
  const since = lastCallOn ? new Date(`${lastCallOn}T00:00:00`) : null;
  const sent = opts.tasks.filter((t) => t.from_me && !t.masked);
  const finished = sent.filter(
    (t) => t.status === "done" && (!since || (t.completed_at && new Date(t.completed_at) >= since)),
  );
  const open = sent.filter((t) => (t.status === "open" || t.status === "in_progress") && t.kind !== "suggestion");
  const undecided = sent.filter((t) => t.kind === "suggestion" && t.status !== "cancelled" && t.status !== "done");
  const questions = opts.items.filter((i) => i.kind === "question" && i.status === "open");
  const owed = opts.items.filter((i) => i.kind === "deliverable" && i.status === "open");

  const block = (title: string, lines: string[]) =>
    lines.length > 0 ? `${title}\n${lines.map((l) => `- ${l}`).join("\n")}` : null;

  const parts = [
    block(`Finished${lastCallOn ? " since the last call" : ""}`, finished.map((t) => t.title)),
    block(`Still open for ${ownerName}`, open.map((t) => t.title)),
    block(`Suggestions ${ownerName} has not decided on`, undecided.map((t) => t.title)),
    block(`Questions for ${ownerName}`, questions.map((i) => i.title)),
    block("What I owe", owed.map((i) => (i.stage === "ready" ? `${i.title} (ready)` : i.title))),
  ].filter((p): p is string => p !== null);

  return parts.length > 0 ? parts.join("\n\n") : "Nothing open from the last call. Start with what is on their mind.";
}
