import "server-only";

// The speed-to-lead alarm: when a free consult inquiry lands from the
// marketing site, the org's owner gets an email within a minute, since the
// PWA has no push. The app's Resend-over-REST pattern (src/lib/report/email.ts):
// no SDK, a plain fetch, a graceful skip when RESEND_API_KEY is unset.
//
// Runs with the service role, and only from the alert route after its shared
// secret checks out. It reads unalerted inquiries, claims each one by stamping
// alerted_at (so a racing ping cannot send twice), and emails that inquiry's
// own org owner. Nothing from an inquiry is ever logged.
//
// Env:
//   RESEND_API_KEY      required to actually send
//   INQUIRY_ALERT_FROM  from address (default onboarding@resend.dev)
//   INQUIRY_ALERT_TO    optional override recipient; otherwise the org's
//                       owner account email, so no coach is hardcoded
//   NEXT_PUBLIC_APP_URL the pipeline link base

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_FROM = "Wild Wanderers <onboarding@resend.dev>";
const DEFAULT_APP_URL = "https://app.wildwanderers.life";
// Only alert on fresh inquiries: a late-configured key never blasts a backlog.
const FRESH_MS = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 10;

const FOREST_DEEP = "#1E331F";
const BONE = "#F6F1E7";
const BONE_DIM = "#C4D3CC";
const AMBER = "#D98A3A";

const INTEREST_LABEL: Record<string, string> = {
  one_on_one: "One-on-one training",
  small_group: "Small-group training",
  wellness: "Wellness coaching",
  boys_program: "Boys program",
  other: "Other",
};

type Inquiry = {
  id: string;
  org_id: string;
  name: string;
  interest: string;
  message: string | null;
  preferred_times: string[] | null;
};

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendPendingInquiryAlerts(): Promise<{ sent: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[inquiry-alert] RESEND_API_KEY not set, skipping alert.");
    return { sent: 0 };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[inquiry-alert] service role key not set, skipping alert.");
    return { sent: 0 };
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const { data: pending } = await admin
    .from("lead_inquiries")
    .select("id")
    .is("alerted_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const pipelineUrl = `${appUrl}/business/pipeline`;
  const from = process.env.INQUIRY_ALERT_FROM || DEFAULT_FROM;
  const ownerEmails = new Map<string, string[]>();
  let sent = 0;

  for (const row of pending ?? []) {
    // Claim it: whoever stamps alerted_at first sends; a racing run skips.
    const { data: claimed } = await admin
      .from("lead_inquiries")
      .update({ alerted_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("alerted_at", null)
      .select("id, org_id, name, interest, message, preferred_times")
      .maybeSingle();
    if (!claimed) continue;
    const q = claimed as Inquiry;

    let to = process.env.INQUIRY_ALERT_TO ? [process.env.INQUIRY_ALERT_TO] : ownerEmails.get(q.org_id);
    if (!to) {
      to = await orgOwnerEmails(admin, q.org_id);
      ownerEmails.set(q.org_id, to);
    }
    if (to.length === 0) {
      console.warn("[inquiry-alert] no owner email for org, alert skipped");
      continue;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject: `New lead: ${q.name}`,
          html: renderHtml(q, pipelineUrl),
          text: renderText(q, pipelineUrl),
        }),
      });
      if (res.ok) sent += 1;
      else {
        console.error("[inquiry-alert] send failed", res.status);
        // Release the claim so the next ping retries it.
        await admin.from("lead_inquiries").update({ alerted_at: null }).eq("id", q.id);
      }
    } catch {
      console.error("[inquiry-alert] send threw");
      await admin.from("lead_inquiries").update({ alerted_at: null }).eq("id", q.id);
    }
  }

  return { sent };
}

async function orgOwnerEmails(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<string[]> {
  const { data: owners } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .eq("role", "owner");
  const emails: string[] = [];
  for (const o of owners ?? []) {
    const { data } = await admin.auth.admin.getUserById(o.id as string);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

function renderText(q: Inquiry, pipelineUrl: string): string {
  const lines = [
    `New lead: ${q.name}`,
    `Interested in: ${INTEREST_LABEL[q.interest] ?? q.interest}`,
  ];
  if (q.preferred_times?.length) lines.push(`Usually free: ${q.preferred_times.join(", ")}`);
  if (q.message) lines.push("", q.message);
  lines.push("", `Accept or dismiss on your pipeline: ${pipelineUrl}`);
  return lines.join("\n");
}

function renderHtml(q: Inquiry, pipelineUrl: string): string {
  const font = "'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif";
  const meta = [
    `Interested in: ${escape(INTEREST_LABEL[q.interest] ?? q.interest)}`,
    q.preferred_times?.length ? `Usually free: ${escape(q.preferred_times.join(", "))}` : null,
  ]
    .filter(Boolean)
    .join("<br />");
  const messageBlock = q.message
    ? `<tr><td style="padding:0 24px 20px 24px;">
         <div style="font-family:${font};font-size:15px;line-height:1.6;color:${BONE};border-left:2px solid ${AMBER};padding-left:14px;">${escape(q.message).replace(/\n/g, "<br />")}</div>
       </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${FOREST_DEEP};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FOREST_DEEP};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${FOREST_DEEP};">
        <tr><td style="padding:32px 24px 12px 24px;">
          <div style="font-family:${font};font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${AMBER};margin-bottom:14px;">
            New website inquiry
          </div>
          <h1 style="margin:0;font-family:Fraunces,Georgia,serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;color:${BONE};">
            ${escape(q.name)}
          </h1>
        </td></tr>
        <tr><td style="padding:0 24px 16px 24px;">
          <div style="font-family:${font};font-size:14px;line-height:1.6;color:${BONE_DIM};">${meta}</div>
        </td></tr>
        ${messageBlock}
        <tr><td style="padding:4px 24px 28px 24px;">
          <a href="${escape(pipelineUrl)}" style="display:inline-block;background:${AMBER};color:#23170c;font-family:${font};font-size:14px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:999px;">Open the pipeline &rarr;</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
