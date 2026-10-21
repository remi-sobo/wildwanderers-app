"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { callCoachStructured, CoachBudgetError, CoachNotConfiguredError } from "@/lib/ai/call";
import { DRAFT_MODEL } from "@/lib/ai/config";
import {
  itemKey,
  matchProposal,
  type CallFlag,
  type CallOwner,
  type CallSection,
  type MatchCandidate,
} from "@/lib/advisor/calls";

// The advisor's call writers (specs/advisor-calls.md). Advisor only, all
// through their own session, so RLS and the advisor_* functions are the
// boundary. Extraction goes through the AI chokepoint (ledgered, budget
// gated). Nothing reaches the owner until the advisor sends, and the send
// runs once however often it is pressed.

export type CallResult = { error: string | null };

const SAVE_FAILED = "That did not save. Try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SECTIONS: CallSection[] = ["owner", "advisor", "decided", "note"];
const OWNERS: CallOwner[] = ["owner", "advisor", "unclear"];
const MAX_TRANSCRIPT = 200_000;

async function advisorContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "advisor") return null;
  return { userId: session.userId, firstName: session.profile.first_name || "the advisor" };
}

function refresh(id?: string) {
  revalidatePath("/advisor/calls");
  revalidatePath("/advisor");
  if (id) revalidatePath(`/advisor/calls/${id}`);
}

// Saves a pasted or uploaded transcript as a call. The request key makes a
// retry return the same call instead of a second one.
export async function createCall(input: {
  orgId: string;
  title: string;
  heldOn: string;
  transcript: string;
  requestKey: string;
}): Promise<CallResult & { id?: string }> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  const title = input.title.trim() || "Call";
  const transcript = input.transcript.trim();
  if (!transcript) return { error: "Paste the transcript first." };
  if (transcript.length > MAX_TRANSCRIPT) return { error: "That transcript is too long. Split it into two calls." };
  if (title.length > 200) return { error: "Use a shorter title." };
  if (!UUID.test(input.requestKey) || !UUID.test(input.orgId)) return { error: SAVE_FAILED };
  const heldOn = DATE.test(input.heldOn) ? input.heldOn : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { error } = await supabase.from("coaching_sessions").upsert(
    {
      org_id: input.orgId,
      advisor_id: ctx.userId,
      title,
      held_on: heldOn,
      transcript,
      request_key: input.requestKey,
    },
    { onConflict: "request_key", ignoreDuplicates: true },
  );
  if (error) return { error: SAVE_FAILED };
  const { data } = await supabase
    .from("coaching_sessions")
    .select("id")
    .eq("request_key", input.requestKey)
    .maybeSingle();
  if (!data) return { error: SAVE_FAILED };
  refresh();
  return { error: null, id: data.id as string };
}

type Extracted = {
  items: {
    section: CallSection;
    kind: "action" | "decision" | "idea" | "goal" | "note";
    text: string;
    owner: CallOwner;
    due_date: string | null;
    quote: string;
    quote_at: string | null;
  }[];
};

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        properties: {
          section: { type: "string", enum: SECTIONS },
          kind: { type: "string", enum: ["action", "decision", "idea", "goal", "note"] },
          text: { type: "string", description: "A short plain sentence, starting with a verb for actions." },
          owner: { type: "string", enum: OWNERS },
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD, only if a specific day was said." },
          quote: { type: "string", description: "The exact words from the transcript this comes from." },
          quote_at: { type: ["string", "null"], description: "The timestamp beside the quote, if the transcript has one." },
        },
        required: ["section", "kind", "text", "owner", "due_date", "quote", "quote_at"],
      },
    },
  },
  required: ["items"],
};

function extractSystem(ownerName: string, advisorName: string, heldOn: string): string {
  return [
    `You read a call transcript between ${ownerName}, who owns a small fitness and family wellness business, and ${advisorName}, their business advisor.`,
    "Propose only what was actually said about the business. Do not invent, infer intentions, or add advice.",
    `Sections: "owner" is work for ${ownerName}; "advisor" is work for ${advisorName}; "decided" is a decision they made; "note" is anything else worth keeping.`,
    `Owner: who will do it. Use "unclear" when the transcript does not make that plain.`,
    `The call was on ${heldOn}. Set due_date only when a specific day was said; resolve weekday names from the call date. Otherwise null.`,
    "quote must be words copied exactly from the transcript. Include the timestamp next to it when there is one.",
    "Skip anything personal: family, health, feelings, money troubles, small talk. Never put health details about anyone in an item.",
    "Mark ideas with kind idea and goals with kind goal. Plain, warm, direct wording. No em dashes.",
  ].join("\n");
}

// Proposes items from the transcript, each with its quote, and checks
// them against existing work. Running it again adds nothing already
// proposed (each item's key is stable).
export async function extractCall(sessionId: string): Promise<CallResult & { added?: number }> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  if (!UUID.test(sessionId)) return { error: SAVE_FAILED };
  const supabase = await createClient();

  const [{ data: call }, { data: orgs }, { data: tasks }, { data: own }] = await Promise.all([
    supabase.from("coaching_sessions").select("id, org_id, held_on, transcript").eq("id", sessionId).maybeSingle(),
    supabase.rpc("advisor_orgs"),
    supabase.rpc("advisor_tasks"),
    supabase.from("advisor_items").select("id, title, status").neq("status", "dropped"),
  ]);
  if (!call) return { error: "That call is not available." };
  const ownerName =
    ((orgs ?? []) as { org_id: string; owner_first_name: string | null }[]).find((o) => o.org_id === call.org_id)
      ?.owner_first_name || "the owner";

  let result: Extracted;
  try {
    result = await callCoachStructured<Extracted>({
      task: "advisor.extract_call",
      model: DRAFT_MODEL,
      system: extractSystem(ownerName, ctx.firstName, call.held_on as string),
      messages: [{ role: "user", content: `Transcript:\n\n${call.transcript as string}` }],
      schema: EXTRACT_SCHEMA,
      maxTokens: 4000,
      context: { actorId: ctx.userId, orgId: call.org_id as string },
    });
  } catch (e) {
    if (e instanceof CoachNotConfiguredError) return { error: "Proposals need Scout, which is not set up yet. Add items by hand below." };
    if (e instanceof CoachBudgetError) return { error: "Scout has reached this month's limit. Add items by hand below." };
    return { error: "Reading the transcript did not finish. Try again, or add items by hand below." };
  }

  const candidates: MatchCandidate[] = [
    ...((tasks ?? []) as { id: string; title: string; status: string; masked: boolean }[]).map((t) => ({
      id: t.id,
      title: t.title,
      done: t.status === "done",
      masked: t.masked,
    })),
  ];
  const ownTitles = ((own ?? []) as { title: string; status: string }[]).map((i) => i.title);

  const rows = (result.items ?? [])
    .filter((i) => SECTIONS.includes(i.section) && typeof i.text === "string" && i.text.trim())
    .slice(0, 40)
    .map((i) => {
      const text = i.text.trim().slice(0, 1000);
      const owner: CallOwner = OWNERS.includes(i.owner) ? i.owner : "unclear";
      const match = i.section === "owner" ? matchProposal(text, candidates) : null;
      const alreadyMine = i.section === "advisor" && ownTitles.some((t) => matchProposal(text, [{ id: "x", title: t, done: false, masked: false }]));
      let flag: CallFlag | null = null;
      if (match) flag = match.flag;
      else if (alreadyMine) flag = "already_in_app";
      else if (i.section === "owner" && owner === "unclear") flag = "needs_clarification";
      else if (i.kind === "idea") flag = "idea";
      else if (i.kind === "goal") flag = "goal";
      return {
        session_id: sessionId,
        org_id: call.org_id as string,
        advisor_id: ctx.userId,
        item_key: itemKey(i.section, text),
        section: i.section,
        text,
        owner,
        due_date: i.due_date && DATE.test(i.due_date) ? i.due_date : null,
        quote: i.quote ? i.quote.slice(0, 2000) : null,
        quote_at: i.quote_at ? i.quote_at.slice(0, 40) : null,
        flag,
        match_task_id: match?.flag === "already_in_app" ? match.matchId : null,
        send_as: i.section === "owner" ? (i.kind === "idea" ? "suggestion" : "assignment") : null,
      };
    });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("session_items")
      .upsert(rows, { onConflict: "session_id,item_key", ignoreDuplicates: true });
    if (error) return { error: SAVE_FAILED };
  }
  await supabase.from("coaching_sessions").update({ status: "extracted" }).eq("id", sessionId).eq("status", "new");
  refresh(sessionId);
  return { error: null, added: rows.length };
}

export async function addCallItem(input: {
  sessionId: string;
  section: CallSection;
  text: string;
  owner: CallOwner;
}): Promise<CallResult> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  const text = input.text.trim();
  if (!text) return { error: "Write the item first." };
  if (text.length > 1000) return { error: "Keep it shorter." };
  if (!SECTIONS.includes(input.section) || !OWNERS.includes(input.owner) || !UUID.test(input.sessionId)) {
    return { error: SAVE_FAILED };
  }
  const supabase = await createClient();
  const { data: call } = await supabase.from("coaching_sessions").select("org_id").eq("id", input.sessionId).maybeSingle();
  if (!call) return { error: "That call is not available." };
  const { error } = await supabase.from("session_items").upsert(
    {
      session_id: input.sessionId,
      org_id: call.org_id as string,
      advisor_id: ctx.userId,
      item_key: itemKey(input.section, text),
      section: input.section,
      text,
      owner: input.owner,
      state: "accepted",
      send_as: input.section === "owner" ? "assignment" : null,
      flag: input.section === "owner" && input.owner === "unclear" ? "needs_clarification" : null,
    },
    { onConflict: "session_id,item_key", ignoreDuplicates: true },
  );
  if (error) return { error: SAVE_FAILED };
  refresh(input.sessionId);
  return { error: null };
}

export type CallItemPatch = {
  text?: string;
  owner?: CallOwner;
  section?: CallSection;
  due_date?: string | null;
  state?: "proposed" | "accepted" | "removed";
  send_as?: "assignment" | "suggestion";
  keep_private?: boolean;
};

export async function updateCallItem(id: string, sessionId: string, patch: CallItemPatch): Promise<CallResult> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  if (!UUID.test(id)) return { error: SAVE_FAILED };
  const row: Record<string, unknown> = {};
  if (patch.text !== undefined) {
    const t = patch.text.trim();
    if (!t || t.length > 1000) return { error: "Keep the item between one and 1,000 characters." };
    row.text = t;
  }
  if (patch.owner !== undefined) {
    if (!OWNERS.includes(patch.owner)) return { error: SAVE_FAILED };
    row.owner = patch.owner;
    // Clarifying the owner clears the flag; making it unclear sets it.
    row.flag = patch.owner === "unclear" ? "needs_clarification" : null;
  }
  if (patch.section !== undefined) {
    if (!SECTIONS.includes(patch.section)) return { error: SAVE_FAILED };
    row.section = patch.section;
  }
  if (patch.due_date !== undefined) row.due_date = patch.due_date && DATE.test(patch.due_date) ? patch.due_date : null;
  if (patch.state !== undefined) {
    if (!["proposed", "accepted", "removed"].includes(patch.state)) return { error: SAVE_FAILED };
    row.state = patch.state;
  }
  if (patch.send_as !== undefined) {
    if (!["assignment", "suggestion"].includes(patch.send_as)) return { error: SAVE_FAILED };
    row.send_as = patch.send_as;
  }
  if (patch.keep_private !== undefined) row.keep_private = Boolean(patch.keep_private);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_items")
    .update(row)
    .eq("id", id)
    .neq("state", "sent")
    .select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh(sessionId);
  return { error: null };
}

export async function sendCall(
  sessionId: string,
): Promise<CallResult & { counts?: { sent_tasks: number; saved_todos: number; kept_on_record: number; held_back: number } }> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  if (!UUID.test(sessionId)) return { error: SAVE_FAILED };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advisor_send_call", { p_session_id: sessionId });
  if (error) return { error: error.code === "42501" ? "That call is not available to send." : SAVE_FAILED };
  const counts = ((data ?? []) as { sent_tasks: number; saved_todos: number; kept_on_record: number; held_back: number }[])[0];
  refresh(sessionId);
  revalidatePath("/tasks");
  return { error: null, counts };
}

export async function deleteCall(sessionId: string): Promise<CallResult> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  if (!UUID.test(sessionId)) return { error: SAVE_FAILED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("coaching_sessions").delete().eq("id", sessionId).select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh();
  return { error: null };
}

export async function saveAgenda(sessionId: string, agenda: string): Promise<CallResult> {
  const ctx = await advisorContext();
  if (!ctx) return { error: "You are signed out." };
  if (!UUID.test(sessionId)) return { error: SAVE_FAILED };
  if (agenda.length > 10000) return { error: "Keep the agenda under 10,000 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaching_sessions")
    .update({ agenda: agenda.trim() || null })
    .eq("id", sessionId)
    .select("id");
  if (error || !data || data.length === 0) return { error: SAVE_FAILED };
  refresh(sessionId);
  return { error: null };
}
