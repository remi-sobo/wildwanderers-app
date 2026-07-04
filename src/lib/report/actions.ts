"use server";

// The "Report an issue" server actions, forked in process from the Trellis
// feature and retargeted to Wild Wanderers. Two steps:
//   interviewIssue  — one guided interview turn (ask another question, or
//                     synthesize the engineering brief).
//   fileIssueReport — file the finished report: upload the screenshot, insert
//                     the row, audit it, and email the build team.
//
// Both are staff-facing today (the FAB entry lives on the coach shell), but the
// org and reporter identity are resolved server-side and never trusted from the
// client, and the table's RLS is org-scoped.

import crypto from "crypto";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyOrg } from "@/lib/data/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit/log";
import { callCoachRaw, CoachNotConfiguredError, CoachBudgetError } from "@/lib/ai/call";
import { SUMMARY_MODEL, coachConfigured } from "@/lib/ai/config";
import { sendReportEmail } from "@/lib/report/email";
import {
  buildInterviewSystem,
  parseInterviewReply,
  questionsAsked,
  defaultSeverity,
  isReportKind,
  MAX_QUESTIONS,
  type ReportKind,
  type InterviewTurn,
  type PageContext,
} from "@/lib/report/interview";

const SCREENSHOT_BUCKET = "issue-report-screenshots";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  return "bin";
}

// Only staff use the FAB entry; guard to owner and coach.
async function requireStaff() {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) {
    return null;
  }
  return session;
}

export type InterviewResult =
  | { action: "ask"; message: string; error: null }
  | { action: "ready"; title: string; prompt: string; error: null }
  | { action: null; error: string };

// One interview turn. The client owns the transcript and resends it each turn.
export async function interviewIssue(input: {
  turns: InterviewTurn[];
  kind: ReportKind;
  hasPhoto?: boolean;
  pageContext?: PageContext;
}): Promise<InterviewResult> {
  const session = await requireStaff();
  if (!session?.profile) return { action: null, error: "You are signed out." };
  if (!coachConfigured()) {
    return { action: null, error: "The intake guide is not set up yet. Add the API key to switch it on." };
  }
  if (!isReportKind(input.kind)) return { action: null, error: "Pick what you are reporting." };

  const turns = (input.turns ?? [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && t.content?.trim())
    .slice(0, 2 * MAX_QUESTIONS + 4)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  if (turns.length === 0) return { action: null, error: "Tell the guide what happened." };

  const system = buildInterviewSystem({
    kind: input.kind,
    hasPhoto: !!input.hasPhoto,
    pageContext: input.pageContext,
    asked: questionsAsked(turns),
  });

  let text: string;
  try {
    text = await callCoachRaw({
      task: "issue.interview",
      model: SUMMARY_MODEL,
      system,
      messages: turns,
      maxTokens: 1500,
      context: { actorId: session.userId, orgId: session.profile.org_id },
    });
  } catch (e) {
    if (e instanceof CoachNotConfiguredError || e instanceof CoachBudgetError) {
      return { action: null, error: e.message };
    }
    return { action: null, error: "Could not reach the guide just now. Try again in a moment." };
  }

  const reply = parseInterviewReply(text);
  if (!reply) return { action: null, error: "The guide got tangled up. Try again." };

  if (reply.action === "ask") return { action: "ask", message: reply.message, error: null };
  return { action: "ready", title: reply.title, prompt: reply.prompt, error: null };
}

export type FileResult = { ok: true; operator: boolean; error: null } | { ok: false; error: string };

// File the finished report.
export async function fileIssueReport(input: {
  kind: ReportKind;
  title: string;
  description: string;
  transcript?: InterviewTurn[];
  pagePath?: string;
  screenshot?: { data: string; mime: string };
}): Promise<FileResult> {
  const session = await requireStaff();
  if (!session?.profile) return { ok: false, error: "You are signed out." };
  if (!isReportKind(input.kind)) return { ok: false, error: "Pick what you are reporting." };

  const title = input.title?.trim().slice(0, 200);
  const description = input.description?.trim().slice(0, 20000);
  if (!title || !description) return { ok: false, error: "Nothing to file yet." };

  const org = await getMyOrg();
  const orgId = session.profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const reportId = crypto.randomUUID();
  const admin = createAdminClient();

  // ── Screenshot → private bucket ──────────────────────────────────────────
  let screenshotPath: string | null = null;
  if (input.screenshot) {
    const { data, mime } = input.screenshot;
    if (!ALLOWED_MIMES.has(mime)) {
      return { ok: false, error: `Screenshot type ${mime} is not allowed.` };
    }
    const b64 = data.includes(",") ? data.split(",", 2)[1] : data;
    const buf = Buffer.from(b64, "base64");
    if (buf.length === 0) return { ok: false, error: "Screenshot is empty." };
    if (buf.length > MAX_FILE_BYTES) return { ok: false, error: "Screenshot is too big (max 10MB)." };

    const path = `${orgId}/${reportId}/${crypto.randomUUID()}.${extForMime(mime)}`;
    const { error: upErr } = await admin.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, buf, { contentType: mime, upsert: false });
    if (upErr) return { ok: false, error: `Screenshot upload failed: ${upErr.message}` };
    screenshotPath = path;
  }

  const reporterName =
    [session.profile.first_name, session.profile.last_name].filter(Boolean).join(" ").trim() ||
    session.email ||
    "A team member";

  const transcript = (input.transcript ?? [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(0, 40)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));

  // ── Row → issue_reports (service role, org resolved server-side) ──────────
  const { error: insErr } = await admin.from("issue_reports").insert({
    id: reportId,
    org_id: orgId,
    reported_by: session.userId,
    reporter_name: reporterName,
    kind: input.kind,
    title,
    description,
    transcript,
    page_path: input.pagePath?.slice(0, 300) || null,
    screenshot_path: screenshotPath,
    severity: defaultSeverity(input.kind),
    status: "open",
  });
  if (insErr) {
    if (screenshotPath) {
      await admin.storage.from(SCREENSHOT_BUCKET).remove([screenshotPath]).catch(() => {});
    }
    console.error("[report/actions] insert failed", insErr.message);
    return { ok: false, error: "Could not save your report. Try again." };
  }

  // ── Audit the filing (ids and labels only, never content) ─────────────────
  await auditLog({
    actorId: session.userId,
    orgId,
    action: "issue.file",
    entityTable: "issue_reports",
    entityId: reportId,
    metadata: { kind: input.kind, has_screenshot: !!screenshotPath },
  });

  // ── Build-team email (best-effort, never fails the report) ────────────────
  try {
    await sendReportEmail({
      reportId,
      kind: input.kind,
      title,
      body: description,
      reporterName,
      orgName: org?.name || "Wild Wanderers",
      pagePath: input.pagePath || null,
      screenshotPath,
    });
  } catch (e) {
    console.error("[report/actions] email send threw", (e as Error)?.message || e);
  }

  // The owner sees the paste-ready brief (a copy-into-the-coding-agent
  // affordance). It is the reporter's own synthesized words, no cross-org data.
  return { ok: true, operator: session.profile.role === "owner", error: null };
}
