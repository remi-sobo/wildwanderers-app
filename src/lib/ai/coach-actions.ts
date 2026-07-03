"use server";

import { getSessionProfile } from "@/lib/auth/get-profile";
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
// summarizing only, no medical or nutrition advice, Wild Wanderers voice.
const COACH_SYSTEM = `You are Coach, an assistant for Gabe, a certified fitness trainer at Wild Wanderers. You help Gabe, never the client directly.

Scope, strict:
- You do programming, habits, and summarizing only.
- You give no medical, nutrition, or health advice, and you diagnose nothing. If something looks like it needs a clinician, say only that Gabe may want to check in with the client, never a diagnosis.
- Never make a medical claim. The wellness score is a motivational progress signal, not a health assessment.
- Never frame the client as broken, unhealthy, or failing. The plan needs work, never the person.

Voice: warm, direct, clear, succinct. No em dashes, use commas or restructure. No AI-giveaway words (transformative, holistic, leverage, unlock, seamless, robust, pivotal). No filler transitions.`;

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
    return { text: null, error: "Coach is not set up yet. Add the API key to switch it on." };
  }

  const [client, plan, wellness] = await Promise.all([
    getClientById(clientId),
    getPlanForClient(clientId),
    getClientWellness(clientId),
  ]);
  if (!client) return { text: null, error: "That client was not found." };

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

  const prompt = `Here is what Wild Wanderers has logged for this client:

${lines.join("\n")}

Write Gabe a short summary he can read in fifteen seconds: where the client is, what is going well, and one or two things worth his attention or a nudge on. Three or four sentences. Coach-facing, never addressed to the client.`;

  try {
    const text = await callCoachText({
      task: "coach.summary",
      model: SUMMARY_MODEL,
      system: COACH_SYSTEM,
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
    return { text: null, error: "Coach could not answer just now. Try again." };
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

export type DraftResult = { draft: WorkoutPlanDraft | null; error: string | null };

// Coach drafts a training plan from Gabe's request and the client's context,
// built to lean on the exercise library. Returns a draft that pre-fills the
// plan builder; nothing is saved or activated until Gabe approves it there.
export async function draftWorkoutPlan(clientId: string, ask: string): Promise<DraftResult> {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) {
    return { draft: null, error: "You are signed out." };
  }
  if (!coachConfigured()) {
    return { draft: null, error: "Coach is not set up yet. Add the API key to switch it on." };
  }
  if (!ask.trim()) return { draft: null, error: "Tell Coach what to draft." };

  const [client, library] = await Promise.all([
    getClientById(clientId),
    getExerciseLibrary(),
  ]);
  if (!client) return { draft: null, error: "That client was not found." };

  // Group the library so Coach knows what it can pull from.
  const libraryList = library.map((l) => `${l.title} (${l.kind})`).join(", ");

  const system = `${COACH_SYSTEM}

You are drafting a training plan for Gabe to review, edit, and approve. It is a draft, never final, and never goes live without Gabe. Build it from the exercise library where you can, using the exact library titles so they link. You may add an exercise not in the library if the plan needs it. Keep loads and reps sensible and general. Never give medical or nutrition advice.`;

  const prompt = `Client: ${clientName(client)}.${client.goal ? ` Their goal: ${client.goal}.` : ""}

Exercise library you can pull from (use these exact titles where they fit):
${libraryList || "(empty)"}

Gabe's request: ${ask.trim()}

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

    await auditLog({
      actorId: session.userId,
      orgId: session.profile.org_id,
      action: "coach.draft_plan",
      entityTable: "clients",
      entityId: clientId,
      metadata: { model: DRAFT_MODEL, workouts: draft.workouts.length },
    });

    return { draft, error: null };
  } catch (e) {
    if (isConfigError(e)) return { draft: null, error: e.message };
    return { draft: null, error: "Coach could not draft that just now. Try again." };
  }
}
