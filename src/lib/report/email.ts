import "server-only";

// Operator notification for a filed "Report an issue". Every filed report fires
// a best-effort email to the build team so a bug or idea surfaces immediately,
// with the paste-ready engineering brief in a monospace block and the
// screenshot inline. Forked in process from the Trellis report email, restyled
// in the Wild Wanderers brand. Degrades gracefully when RESEND_API_KEY is unset
// (the row still saves, a console line says so). Never blocks filing.
//
// Env:
//   RESEND_API_KEY         — required to actually send
//   ISSUE_NOTIFY_EMAIL     — recipient (default remi@ambitionangels.org)
//   ISSUE_NOTIFY_FROM      — from address (default onboarding@resend.dev)
//   ISSUE_NOTIFY_REPLY_TO  — reply-to (default ISSUE_NOTIFY_EMAIL)

import { createAdminClient } from "@/lib/supabase/admin";
import { kindEmoji, kindNoun, type ReportKind } from "@/lib/report/interview";

const DEFAULT_TO = "remi@ambitionangels.org";
const DEFAULT_FROM = "Wild Wanderers Reports <onboarding@resend.dev>";

// Wild Wanderers brand (CLAUDE.md design system).
const FOREST_DEEP = "#1E331F";
const BONE = "#F6F1E7";
const BONE_DIM = "#C4D3CC";
const AMBER = "#D98A3A";

const SCREENSHOT_BUCKET = "issue-report-screenshots";

interface ResendResult {
  ok: boolean;
  status: number;
  body: string;
  messageId?: string;
}

async function resendSend(payload: Record<string, unknown>): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[report/email] RESEND_API_KEY not set, skipping send.");
    return { ok: false, status: 0, body: "RESEND_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    let messageId: string | undefined;
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed.id === "string") messageId = parsed.id;
    } catch {
      // non-JSON
    }
    return { ok: res.ok, status: res.status, body, messageId };
  } catch (e) {
    console.error("[report/email] resend send threw", e);
    return { ok: false, status: 0, body: String((e as Error)?.message || e) };
  }
}

export interface ReportEmailInput {
  reportId: string;
  kind: ReportKind;
  title: string;
  // The synthesized engineering brief, or the plain description.
  body: string;
  reporterName: string;
  orgName: string;
  pagePath: string | null;
  screenshotPath: string | null;
}

export async function sendReportEmail(input: ReportEmailInput): Promise<ResendResult> {
  const to = process.env.ISSUE_NOTIFY_EMAIL || DEFAULT_TO;
  const from = process.env.ISSUE_NOTIFY_FROM || DEFAULT_FROM;
  const replyTo = process.env.ISSUE_NOTIFY_REPLY_TO || to;

  const subject = `${kindEmoji(input.kind)} [Wild Wanderers] ${kindNoun(input.kind)}: ${input.title}`;
  const screenshotUrl = await signScreenshot(input.screenshotPath);

  const html = renderHtml({ ...input, screenshotUrl });
  const text = renderText(input);

  return resendSend({ from, to, reply_to: replyTo, subject, html, text });
}

async function signScreenshot(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 30); // 30-day signed URL for the triage window
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

function renderHtml(opts: {
  kind: ReportKind;
  title: string;
  body: string;
  reporterName: string;
  orgName: string;
  pagePath: string | null;
  screenshotUrl: string | null;
}): string {
  const contextBits = [opts.reporterName, opts.orgName, opts.pagePath]
    .filter((v): v is string => Boolean(v))
    .map(escape)
    .join(" · ");
  const shot = opts.screenshotUrl
    ? `<tr><td style="padding:0 24px 20px 24px;">
         <a href="${escape(opts.screenshotUrl)}" style="display:block;">
           <img src="${escape(opts.screenshotUrl)}" alt="screenshot" style="display:block;width:100%;border-radius:10px;border:1px solid rgba(246,241,231,0.12);" />
         </a>
       </td></tr>`
    : "";
  const inner = `
    <tr><td style="padding:32px 24px 12px 24px;">
      <div style="font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${AMBER};margin-bottom:14px;">
        ${kindEmoji(opts.kind)} ${escape(kindNoun(opts.kind))} report${contextBits ? ` · ${contextBits}` : ""}
      </div>
      <h1 style="margin:0;font-family:Fraunces,Georgia,serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;color:${BONE};">
        ${escape(opts.title)}
      </h1>
    </td></tr>
    <tr><td style="padding:0 24px 16px 24px;"><div style="height:1px;width:60px;background:${AMBER};"></div></td></tr>
    <tr><td style="padding:0 24px 20px 24px;">
      <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;color:${BONE};background:rgba(217,138,58,0.08);border:1px solid rgba(217,138,58,0.30);border-radius:12px;padding:16px 18px;">${escape(opts.body)}</pre>
    </td></tr>
    ${shot}
    <tr><td style="padding:0 24px 28px 24px;">
      <div style="font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${BONE_DIM};opacity:0.7;">
        Wild Wanderers · Report an issue · ©2026
      </div>
    </td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${FOREST_DEEP};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FOREST_DEEP};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${FOREST_DEEP};">
        ${inner}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(input: ReportEmailInput): string {
  const lines: string[] = [];
  lines.push(`${kindNoun(input.kind)} report: ${input.title}`);
  lines.push(`From: ${input.reporterName} (${input.orgName})`);
  if (input.pagePath) lines.push(`Where: ${input.pagePath}`);
  lines.push("");
  lines.push(input.body);
  lines.push("");
  if (input.screenshotPath) lines.push("A screenshot is attached (see the HTML email).");
  return lines.join("\n");
}

function escape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
