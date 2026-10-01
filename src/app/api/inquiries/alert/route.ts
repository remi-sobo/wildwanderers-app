import { createHash, timingSafeEqual } from "node:crypto";
import { sendPendingInquiryAlerts } from "@/lib/business/inquiry-alert";

// The marketing site's /api/fitness/inquire pings this right after a new
// inquiry lands, so the owner's alert email goes out within a minute. The
// ping carries no inquiry data, only the shared secret; this route then sends
// whatever unalerted inquiries exist, each at most once. A leaked secret can
// only make it send alerts that were due anyway. Responses carry no data.
//
// Env: INQUIRY_ALERT_SECRET, the same value set on the marketing site.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.INQUIRY_ALERT_SECRET;
  if (!secret) return Response.json({ ok: false }, { status: 503 });

  const given = request.headers.get("x-inquiry-alert-secret") ?? "";
  if (!given || !matches(given, secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    await sendPendingInquiryAlerts();
    return Response.json({ ok: true });
  } catch {
    console.error("[inquiries/alert] run failed");
    return Response.json({ ok: false }, { status: 500 });
  }
}
