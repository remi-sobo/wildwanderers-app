"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyOrg } from "@/lib/data/org";
import { getClientById, clientName } from "@/lib/data/clients";
import { getPlanForClient } from "@/lib/data/plans";
import { getClientWellness } from "@/lib/data/coach-fitness";
import { getExerciseLibrary } from "@/lib/data/exercises";
import { auditLog } from "@/lib/audit/log";
import {
  callCoachText,
  callCoachStructured,
  CoachNotConfiguredError,
  CoachBudgetError,
} from "@/lib/ai/call";
import { SUMMARY_MODEL, DRAFT_MODEL, coachConfigured } from "@/lib/ai/config";

// The plan-builder draft shape Coach fills, ready for Gabe to review and
// activate. All string fields, matching the builder's inputs.
export type DraftExercise = {
  title: string;
  kind: string;
  sets: string;
  reps: string;
  load: string;
  libraryItemId: string | null;
  mediaUrl: string;
};
export type DraftWorkout = {
  weekNumber: number;
  dayNumber: number;
  title: string;
  exercises: DraftExercise[];
};
export type WorkoutPlanDraft = {
  title: string;
  goal: string;
  durationWeeks: string;
  workouts: DraftWorkout[];
};

export type CoachResult = { text: string | null; error: string | null };

// The scope Coach never steps outside of. Coach-facing, programming/habits/
// summarizing only, no medical or nutrition advice, brand voice. Named for the
// coach and org that own the surface so a second org reads as its own, not Gabe's.
function coachSystem(coach: string, org: string): string {
  return `You are Scout, an assistant for ${coach}, a certified fitness trainer at ${org}. You help ${coach}, never the client directly.

Scope, strict:
- You do programming, habits, and summarizing only.
- You give no medical, nutrition, or health advice, and you diagnose nothing. If something looks like it needs a clinician, say only that ${coach} may want to check in with the client, never a diagnosis.
- Never make a medical claim. The wellness score is a motivational progress signal, not a health assessment.
- Never frame the client as broken, unhealthy, or failing. The plan needs work, never the person.

Voice: warm, direct, clear, succinct. No em dashes, use commas or restructure. No AI-giveaway words (transformative, holistic, leverage, unlock, seamless, robust, pivotal). No filler transitions.`;
}

// The caller's coaching name and org, for the system prompt. Falls back to
// generic labels so Coach never speaks in another org's name.
function coachIdentity(
  firstName: string | undefined,
  org: { name: string } | null,
): { coach: string; org: string } {
  return {
    coach: firstName?.trim() || "the coach",
    org: org?.name?.trim() || "the gym",
  };
}

function isConfigError(e: unknown): e is CoachNotConfiguredError | CoachBudgetError {
  return e instanceof CoachNotConfiguredError || e instanceof CoachBudgetError;
}

// Coach reads a client's training and wellness picture and returns a short,
// plain, coach-facing summary for Gabe.
export async function summarizeClient(clientId: string): Promise<CoachResult> {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) {
    return { text: null, error: "You are signed out." };
  }
  if (!coachConfigured()) {
    return { text: null, error: "Scout is not set up yet. Add the API key to switch it on." };
  }

  const [client, plan, wellness, org] = await Promise.all([
    getClientById(clientId),
    getPlanForClient(clientId),
    getClientWellness(clientId),
    getMyOrg(),
  ]);
  if (!client) return { text: null, error: "That client was not found." };
  const { coach, org: orgName } = coachIdentity(session.profile.first_name, org);

  // Build a compact, factual context. No fabrication: only what is logged.
  const lines: string[] = [];
  lines.push(`Client: ${clientName(client)}.`);
  if (client.goal) lines.push(`Their goal: ${client.goal}`);
  if (plan) {
    const total = plan.workouts.reduce((n, w) => n + w.exercises.length, 0);
    lines.push(`Active plan: "${plan.title}", ${plan.workouts.length} workouts, ${total} exercises.`);
  } else {
    lines.push("No active training plan yet.");
  }
  if (wellness.hasConsent) {
    const s = wellness.score;
    if (s?.score != null) {
      lines.push(
        `Wellness score ${s.score}/100 (consistency ${s.consistency ?? "n/a"}, movement ${s.movement ?? "n/a"}, habits ${s.habits ?? "n/a"}).`,
      );
    }
    if (wellness.weightSeries.length >= 2) {
      const first = wellness.weightSeries[0].lb;
      const last = wellness.weightSeries[wellness.weightSeries.length - 1].lb;
      const delta = Math.round((last - first) * 10) / 10;
      lines.push(`Weight has moved ${delta > 0 ? "+" : ""}${delta} lb over ${wellness.weightSeries.length} check-ins (${last} lb now).`);
    }
    if (wellness.habits.length > 0) {
      lines.push(
        "Habits this week: " +
          wellness.habits.map((h) => `${h.title} ${h.logs_this_week}/${h.target_per_week}`).join(", ") + ".",
      );
    }
    if (wellness.recentActivity.length > 0) {
      lines.push(
        "Recent movement: " +
          wellness.recentActivity
            .slice(0, 4)
            .map((a) => `${a.kind}${a.duration_minutes ? ` ${a.duration_minutes}m` : ""}`)
            .join(", ") + ".",
      );
    }
  } else {
    lines.push("The client has not opened wellness tracking yet.");
  }

  const prompt = `Here is what ${orgName} has logged for this client:

${lines.join("\n")}

Write ${coach} a short summary they can read in fifteen seconds: where the client is, what is going well, and one or two things worth their attention or a nudge on. Three or four sentences. Coach-facing, never addressed to the client.`;

  try {
    const text = await callCoachText({
      task: "coach.summary",
      model: SUMMARY_MODEL,
      system: coachSystem(coach, orgName),
      messages: [{ role: "user", content: prompt }],
      maxTokens: 700,
      context: { actorId: session.userId, orgId: session.profile.org_id },
    });

    await auditLog({
      actorId: session.userId,
      orgId: session.profile.org_id,
      action: "coach.summary",
      entityTable: "clients",
      entityId: clientId,
      metadata: { model: SUMMARY_MODEL },
    });

    return { text, error: null };
  } catch (e) {
    if (isConfigError(e)) return { text: null, error: e.message };
    return { text: null, error: "Scout could not answer just now. Try again." };
  }
}

// Coach drafts a one-line blurb for a Trailhead Library post. Optional assist
// in the composer: Gabe pastes a link (and maybe a note), Coach returns a plain,
// warm sentence in the Wild Wanderers voice, and Gabe edits and publishes. Same
// chokepoint as every other call, so it voice-sweeps, logs to the ledger, and
// degrades to the friendly not-configured state when no key is set.
export async function draftPostBlurb(input: {
  link?: string;
  title?: string;
  note?: string;
  category?: string;
}): Promise<CoachResult> {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) {
    return { text: null, error: "You are signed out." };
  }
  if (!coachConfigured()) {
    return { text: null, error: "Scout is not set up yet. Add the API key to switch it on." };
  }

  const link = input.link?.trim();
  const note = input.note?.trim();
  const title = input.title?.trim();
  if (!link && !note && !title) {
    return { text: null, error: "Paste a link or a few words first, then Coach can draft a blurb." };
  }

  const org = await getMyOrg();
  const { coach, org: orgName } = coachIdentity(session.profile.first_name, org);

  const facts: string[] = [];
  if (title) facts.push(`Working title: ${title}`);
  if (link) facts.push(`Link: ${link}`);
  if (input.category) facts.push(`Category: ${input.category}`);
  if (note) facts.push(`What ${coach} said about it: ${note}`);

  const system = `You write short blurbs for the Trailhead Library, ${orgName}'s field journal. One sentence, warm, plain, and specific, the way a person points a friend to something good on a trail. Never hype, never a sales pitch. No medical, nutrition, or health claims. Voice: no em dashes, use commas or restructure. No AI-giveaway words (transformative, holistic, leverage, unlock, seamless, robust, pivotal). No filler transitions.`;

  const prompt = `Draft a one-sentence blurb to introduce this post in the library. Base it only on what is given, invent no facts, name no results.

${facts.join("\n")}

Return just the sentence, nothing else.`;

  try {
    const text = await callCoachText({
      task: "library.blurb",
      model: SUMMARY_MODEL,
      system,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 200,
      context: { actorId: session.userId, orgId: session.profile.org_id },
    });

    await auditLog({
      actorId: session.userId,
      orgId: session.profile.org_id,
      action: "library.blurb",
      entityTable: "posts",
      metadata: { model: SUMMARY_MODEL, hadLink: Boolean(link) },
    });

    return { text: text.trim(), error: null };
  } catch (e) {
    if (isConfigError(e)) return { text: null, error: e.message };
    return { text: null, error: "Scout could not draft that just now. Try again." };
  }
}

// Scout helps Gabe shape his own Alongside note: it expands his rough words into
// a short, honest, first-person note in HIS voice. It invents nothing, no events,
// results, or feelings he did not give. His voice is always final, and nothing
// publishes without him.
export async function draftCoachShare(input: {
  tone?: string;
  title?: string;
  note?: string;
  trainingNote?: string;
}): Promise<CoachResult> {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) {
    return { text: null, error: "You are signed out." };
  }
  if (!coachConfigured()) {
    return { text: null, error: "Scout is not set up yet. Add the API key to switch it on." };
  }

  const note = input.note?.trim();
  const title = input.title?.trim();
  const training = input.trainingNote?.trim();
  if (!note && !title && !training) {
    return { text: null, error: "Jot a few words first, then Scout can shape them." };
  }

  const org = await getMyOrg();
  const { coach, org: orgName } = coachIdentity(session.profile.first_name, org);

  const toneLabel: Record<string, string> = {
    note: "a note",
    training: "training",
    lesson: "a lesson",
    win: "a win",
    tough_day: "a tough day",
  };
  const facts: string[] = [];
  if (title) facts.push(`Working title: ${title}`);
  if (input.tone) facts.push(`Tone: ${toneLabel[input.tone] ?? input.tone}`);
  if (training) facts.push(`What ${coach} moved this week: ${training}`);
  if (note) facts.push(`${coach}'s rough words: ${note}`);

  const system = `You help ${coach}, a coach at ${orgName}, shape a short weekly note to the people ${coach} coaches. It is ${coach}'s own first-person voice, honest and human, leading by example, never above anyone. Two to four sentences. Invent nothing: no events, results, numbers, or feelings ${coach} did not give you; if the words are thin, keep it short rather than embroider. No medical, nutrition, or health claims, and never frame anyone as broken. Voice: no em dashes, use commas or restructure; no AI-giveaway words (transformative, holistic, leverage, unlock, seamless, robust, pivotal); no filler transitions. Write only what ${coach} could stand behind as their own.`;

  const prompt = `Shape these into a short note in ${coach}'s own voice, first person. Base it only on what is given.

${facts.join("\n")}

Return just the note, nothing else.`;

  try {
    const text = await callCoachText({
      task: "coach_share.draft",
      model: SUMMARY_MODEL,
      system,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 300,
      context: { actorId: session.userId, orgId: session.profile.org_id },
    });

    await auditLog({
      actorId: session.userId,
      orgId: session.profile.org_id,
      action: "coach_share.draft_assist",
      entityTable: "coach_shares",
      metadata: { model: SUMMARY_MODEL, tone: input.tone ?? null },
    });

    return { text: text.trim(), error: null };
  } catch (e) {
    if (isConfigError(e)) return { text: null, error: e.message };
    return { text: null, error: "Scout could not draft that just now. Try again." };
  }
}

const KINDS = ["strength", "cardio", "mobility", "warmup", "cooldown", "skill"];

// What Coach returns for a draft (before we match it to the library).
type CoachPlanShape = {
  title: string;
  goal: string;
  duration_weeks: number;
  workouts: {
    title: string;
    week_number: number;
    day_number: number;
    exercises: { title: string; kind: string; sets: number; reps: string; load: string }[];
  }[];
};

const PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    goal: { type: "string" },
    duration_weeks: { type: "integer" },
    workouts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          week_number: { type: "integer" },
          day_number: { type: "integer" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                kind: { type: "string", enum: KINDS },
                sets: { type: "integer" },
                reps: { type: "string" },
                load: { type: "string" },
              },
              required: ["title", "kind", "sets", "reps", "load"],
            },
          },
        },
        required: ["title", "week_number", "day_number", "exercises"],
      },
    },
  },
  required: ["title", "goal", "duration_weeks", "workouts"],
};

export type DraftResult = {
  draft: WorkoutPlanDraft | null;
  planId: string | null;
  error: string | null;
};

// Coach drafts a training plan from Gabe's request and the client's context,
// built to lean on the exercise library. The draft is saved as a resting
// 'draft' plan (never activated) and opens in the builder for Gabe to review,
// edit, and approve. Nothing goes live until he activates it.
export async function draftWorkoutPlan(clientId: string, ask: string): Promise<DraftResult> {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) {
    return { draft: null, planId: null, error: "You are signed out." };
  }
  if (!coachConfigured()) {
    return { draft: null, planId: null, error: "Scout is not set up yet. Add the API key to switch it on." };
  }
  if (!ask.trim()) return { draft: null, planId: null, error: "Tell Coach what to draft." };

  const [client, library, org] = await Promise.all([
    getClientById(clientId),
    getExerciseLibrary(),
    getMyOrg(),
  ]);
  if (!client) return { draft: null, planId: null, error: "That client was not found." };
  const { coach, org: orgName } = coachIdentity(session.profile.first_name, org);

  // Group the library so Coach knows what it can pull from.
  const libraryList = library.map((l) => `${l.title} (${l.kind})`).join(", ");

  const system = `${coachSystem(coach, orgName)}

You are drafting a training plan for ${coach} to review, edit, and approve. It is a draft, never final, and never goes live without ${coach}. Build it from the exercise library where you can, using the exact library titles so they link. You may add an exercise not in the library if the plan needs it. Keep loads and reps sensible and general. Never give medical or nutrition advice.`;

  const prompt = `Client: ${clientName(client)}.${client.goal ? ` Their goal: ${client.goal}.` : ""}

Exercise library you can pull from (use these exact titles where they fit):
${libraryList || "(empty)"}

${coach}'s request: ${ask.trim()}

Draft the plan.`;

  try {
    const plan = await callCoachStructured<CoachPlanShape>({
      task: "coach.draft_plan",
      model: DRAFT_MODEL,
      system,
      messages: [{ role: "user", content: prompt }],
      schema: PLAN_SCHEMA,
      maxTokens: 4000,
      context: { actorId: session.userId, orgId: session.profile.org_id },
    });

    // Match Coach's exercises to the library by title, filling the link and media.
    const byTitle = new Map(library.map((l) => [l.title.toLowerCase().trim(), l]));
    const draft: WorkoutPlanDraft = {
      title: plan.title ?? "",
      goal: plan.goal ?? "",
      durationWeeks: plan.duration_weeks ? String(plan.duration_weeks) : "",
      workouts: (plan.workouts ?? []).map((w) => ({
        weekNumber: w.week_number || 1,
        dayNumber: w.day_number || 1,
        title: w.title ?? "",
        exercises: (w.exercises ?? []).map((e) => {
          const match = byTitle.get((e.title ?? "").toLowerCase().trim());
          return {
            title: e.title ?? "",
            kind: match?.kind ?? (KINDS.includes(e.kind) ? e.kind : "strength"),
            sets: e.sets ? String(e.sets) : "",
            reps: e.reps ?? "",
            load: e.load ?? "",
            libraryItemId: match?.id ?? null,
            mediaUrl: match?.media_url ?? "",
          };
        }),
      })),
    };

    // Save the draft as a resting 'draft' plan so it survives the tab and
    // shows in the drafts list. Never activated here; Gabe does that in the
    // builder. RLS: Gabe's own staff policy governs the write.
    const supabase = await createClient();
    const { data: saved, error: saveError } = await supabase.rpc("create_plan_atomic", {
      p_plan: {
        client_id: clientId,
        title: draft.title.trim() || "Scout draft",
        goal: draft.goal.trim() || null,
        duration_weeks: draft.durationWeeks || null,
        initiated_by: session.profile.role,
        ai_generated: true,
        origin_prompt: ask.trim(),
      },
      p_workouts: draft.workouts
        .filter((w) => w.exercises.length > 0)
        .map((w) => ({
          day_number: w.dayNumber,
          week_number: w.weekNumber,
          title: w.title.trim() || null,
          exercises: w.exercises.map((e, i) => ({
            title: e.title.trim(),
            kind: e.kind,
            sets: e.sets,
            reps: e.reps,
            load: e.load,
            sort_order: i,
            library_item_id: e.libraryItemId,
            media_url: e.mediaUrl,
          })),
        })),
    });
    if (saveError || !saved?.plan_id) {
      return {
        draft: null,
        planId: null,
        error: "Scout drafted it, but the draft did not save. Try again.",
      };
    }
    const planId = saved.plan_id as string;

    await auditLog({
      actorId: session.userId,
      orgId: session.profile.org_id,
      action: "coach.draft_plan",
      entityTable: "training_plans",
      entityId: planId,
      metadata: { model: DRAFT_MODEL, clientId, workouts: draft.workouts.length },
    });

    return { draft, planId, error: null };
  } catch (e) {
    if (isConfigError(e)) return { draft: null, planId: null, error: e.message };
    return { draft: null, planId: null, error: "Scout could not draft that just now. Try again." };
  }
}

export type CheckInStructure = {
  summary: string;
  mood: string;
  wins: string[];
  blockers: string[];
  focus: string;
};

const CHECKIN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    mood: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
    focus: { type: "string" },
  },
  required: ["summary", "mood", "wins", "blockers", "focus"],
};

export type StructureResult = { structured: CheckInStructure | null; error: string | null };

// Coach turns a client's raw check-in into a fast structured read for Gabe, and
// marks it reviewed. Runs as Gabe (RLS), so the write uses the staff update
// policy on check_ins. Structuring and summarizing only, never advice.
export async function structureCheckIn(checkInId: string): Promise<StructureResult> {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) {
    return { structured: null, error: "You are signed out." };
  }
  if (!coachConfigured()) {
    return { structured: null, error: "Scout is not set up yet. Add the API key to switch it on." };
  }

  const supabase = await createClient();
  const [{ data: checkIn }, org] = await Promise.all([
    supabase.from("check_ins").select("id, body").eq("id", checkInId).maybeSingle(),
    getMyOrg(),
  ]);
  if (!checkIn?.body) return { structured: null, error: "That check-in has no text to structure." };
  const { coach, org: orgName } = coachIdentity(session.profile.first_name, org);

  const system = `${coachSystem(coach, orgName)}

You are structuring a client's check-in into a fast read for ${coach}. Summarize only. Pull out mood in a couple of words, concrete wins, and any blockers, and name one focus for ${coach} to consider. Never give the client medical or nutrition advice, and never frame them as failing.`;

  try {
    const structured = await callCoachStructured<CheckInStructure>({
      task: "coach.structure_checkin",
      model: SUMMARY_MODEL,
      system,
      messages: [{ role: "user", content: `The client wrote:\n\n${checkIn.body}` }],
      schema: CHECKIN_SCHEMA,
      maxTokens: 900,
      context: { actorId: session.userId, orgId: session.profile.org_id },
    });

    const { error: upErr } = await supabase
      .from("check_ins")
      .update({ structured, status: "reviewed" })
      .eq("id", checkInId);
    if (upErr) return { structured: null, error: "Structured, but saving it failed. Try again." };

    await auditLog({
      actorId: session.userId,
      orgId: session.profile.org_id,
      action: "coach.structure_checkin",
      entityTable: "check_ins",
      entityId: checkInId,
      metadata: { model: SUMMARY_MODEL },
    });

    return { structured, error: null };
  } catch (e) {
    if (isConfigError(e)) return { structured: null, error: e.message };
    return { structured: null, error: "Scout could not structure that just now. Try again." };
  }
}
