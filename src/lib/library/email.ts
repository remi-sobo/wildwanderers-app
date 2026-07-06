import "server-only";

// The weekly Trailhead Library note, sent through Resend. Reuses the app's
// existing Resend-over-REST pattern (src/lib/report/email.ts): no SDK, a plain
// fetch, and a graceful skip when RESEND_API_KEY is unset. Recipients get an
// individual email (via the batch endpoint), so no one sees another address.
//
// Env:
//   RESEND_API_KEY  — required to actually send
//   LIBRARY_FROM    — from address (default onboarding@resend.dev)

const DEFAULT_FROM = "Wild Wanderers <onboarding@resend.dev>";
const BATCH_LIMIT = 100;

const FOREST_DEEP = "#1E331F";
const BONE = "#F6F1E7";
const BONE_DIM = "#C4D3CC";
const AMBER = "#D98A3A";

export type LibraryNote = {
  title: string;
  body: string | null;
  externalLink: string | null;
  orgName: string;
  libraryUrl: string; // the public /trailhead URL, for the footer link
};

export type SendResult = { ok: boolean; sent: number; error: string | null };

// Send one note to many recipients. Chunks into the batch endpoint's limit and
// counts what actually went out. Returns ok=false only when nothing could send.
export async function sendLibraryNote(
  recipients: string[],
  note: LibraryNote,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[library/email] RESEND_API_KEY not set, skipping send.");
    return { ok: false, sent: 0, error: "Email is not set up yet. Add the Resend key to send." };
  }
  if (recipients.length === 0) {
    return { ok: false, sent: 0, error: "No recipients yet. Members and subscribers show up here as they join." };
  }

  const from = process.env.LIBRARY_FROM || DEFAULT_FROM;
  const subject = `Trailhead Library · ${note.title}`;
  const html = renderHtml(note);
  const text = renderText(note);

  let sent = 0;
  let lastError: string | null = null;

  for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
    const chunk = recipients.slice(i, i + BATCH_LIMIT);
    const payload = chunk.map((to) => ({ from, to, subject, html, text }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        sent += chunk.length;
      } else {
        lastError = `Resend responded ${res.status}`;
        console.error("[library/email] batch failed", res.status, await res.text());
      }
    } catch (e) {
      lastError = String((e as Error)?.message || e);
      console.error("[library/email] batch threw", e);
    }
  }

  if (sent === 0) return { ok: false, sent: 0, error: lastError ?? "The send did not go through. Try again." };
  return { ok: true, sent, error: null };
}

function renderHtml(note: LibraryNote): string {
  const bodyBlock = note.body
    ? `<tr><td style="padding:0 24px 20px 24px;">
         <div style="font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.62;color:${BONE};">${escape(note.body).replace(/\n/g, "<br />")}</div>
       </td></tr>`
    : "";
  const linkBlock = note.externalLink
    ? `<tr><td style="padding:4px 24px 24px 24px;">
         <a href="${escape(note.externalLink)}" style="display:inline-block;background:${AMBER};color:#23170c;font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:999px;">Open it &rarr;</a>
       </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${FOREST_DEEP};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FOREST_DEEP};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${FOREST_DEEP};">
        <tr><td style="padding:32px 24px 12px 24px;">
          <div style="font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${AMBER};margin-bottom:14px;">
            Trailhead Library · ${escape(note.orgName)}
          </div>
          <h1 style="margin:0;font-family:Fraunces,Georgia,serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;color:${BONE};">
            ${escape(note.title)}
          </h1>
        </td></tr>
        <tr><td style="padding:0 24px 16px 24px;"><div style="height:1px;width:60px;background:${AMBER};"></div></td></tr>
        ${bodyBlock}
        ${linkBlock}
        <tr><td style="padding:8px 24px 28px 24px;">
          <div style="font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;font-size:12px;line-height:1.6;color:${BONE_DIM};opacity:0.85;">
            You are getting this because you are with Wild Wanderers or you asked for the weekly trail note.
            Read more at <a href="${escape(note.libraryUrl)}" style="color:${BONE_DIM};">the Trailhead Library</a>, or reply to stop.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(note: LibraryNote): string {
  const lines: string[] = [];
  lines.push(`Trailhead Library · ${note.orgName}`);
  lines.push("");
  lines.push(note.title);
  if (note.body) {
    lines.push("");
    lines.push(note.body);
  }
  if (note.externalLink) {
    lines.push("");
    lines.push(`Open it: ${note.externalLink}`);
  }
  lines.push("");
  lines.push(`More at the Trailhead Library: ${note.libraryUrl}`);
  lines.push("Reply to stop the weekly note.");
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
