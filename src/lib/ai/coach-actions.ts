"use server";

import { getSessionProfile } from "@/lib/auth/get-profile";
import { getClientById, clientName } from "@/lib/data/clients";
import { getPlanForClient } from "@/lib/data/plans";
import { getClientWellness } from "@/lib/data/coach-fitness";
import { auditLog } from "@/lib/audit/log";
import {
  callCoachText,
  CoachNotConfiguredError,
  CoachBudgetError,
} from "@/lib/ai/call";
import { SUMMARY_MODEL, coachConfigured } from "@/lib/ai/config";

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
