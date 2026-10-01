// The drafted first reply's shape, shared by the server action (which parses
// Scout's output and stores it on the lead timeline) and the drawer (which
// reads the latest stored draft back). One plain-text format for both, so
// the timeline entry stays readable as is.

export type FirstReplyDraft = { text: string; subject: string; email: string };

export function formatFirstReply(d: FirstReplyDraft): string {
  return `TEXT:\n${d.text}\n\nEMAIL SUBJECT: ${d.subject}\nEMAIL:\n${d.email}`;
}

export function parseFirstReply(raw: string): FirstReplyDraft | null {
  const m = raw.match(/TEXT:\s*([\s\S]*?)\s*EMAIL SUBJECT:\s*(.*?)\s*\n\s*EMAIL:\s*([\s\S]*)$/);
  if (!m) return null;
  const [, text, subject, email] = m.map((s) => s.trim());
  if (!text || !email) return null;
  return { text, subject: subject || "Your free consult", email };
}
