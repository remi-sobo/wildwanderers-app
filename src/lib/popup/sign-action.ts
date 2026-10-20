"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// The public waiver signing path (the QR at the table). Anyone with a day's
// link may call it, signed in or not. The rate limit and the honeypot live
// here; sign_popup_waiver validates everything again in the database, which
// is the real boundary. Nothing personal is logged or read back.

export type SignInput = {
  fullName: string;
  email: string;
  phone: string;
  isMinor: boolean;
  age: string;
  emergencyName: string;
  emergencyPhone: string;
  photoOk: boolean | null;
  agreed: boolean;
  signedName: string;
  guardianName: string;
  guardianRelationship: string;
  joinList: boolean;
  company: string; // honeypot
};

export type SignResult = { ok: true; here: boolean } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort in-memory IP limiter, the same speed bump as the marketing
// forms. It does not span serverless instances; the database checks the rest.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

const ERRORS: Record<string, string> = {
  link_expired: "This sign-in link has closed. Ask Gabe for today's code.",
  no_waiver: "The waiver is not ready yet. Please sign the paper copy at the table.",
  too_young: "Pop-ups are for ages 10 and up.",
  guardian_required: "A parent or guardian needs to sign for anyone under 18.",
  invalid: "Something is missing. Check the form and try again.",
};

export async function signPopupWaiver(token: string, input: SignInput): Promise<SignResult> {
  if (input.company.trim()) return { ok: true, here: false };

  const fullName = input.fullName.trim();
  const email = input.email.trim();
  if (!fullName) return { ok: false, error: "Add the participant's name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Check the email address." };
  if (!input.emergencyName.trim() || !input.emergencyPhone.trim()) {
    return { ok: false, error: "Add an emergency contact, name and phone." };
  }
  if (input.photoOk === null) return { ok: false, error: "Choose yes or no for photos." };
  if (!input.agreed) return { ok: false, error: "Check the box to say you have read the agreement." };
  if (!input.signedName.trim()) return { ok: false, error: "Type your full name to sign." };

  let age: number | null = null;
  if (input.isMinor) {
    age = Number(input.age);
    if (!Number.isInteger(age) || age < 1 || age > 17) return { ok: false, error: "Add the participant's age." };
    if (age < 10) return { ok: false, error: ERRORS.too_young };
    if (!input.guardianName.trim() || !input.guardianRelationship.trim()) {
      return { ok: false, error: ERRORS.guardian_required };
    }
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || h.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) return { ok: false, error: "A few too many tries. Wait a minute and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sign_popup_waiver", {
    p_token: token,
    p_full_name: fullName,
    p_email: email,
    p_phone: input.phone.trim(),
    p_age_if_minor: age,
    p_emergency_name: input.emergencyName.trim(),
    p_emergency_phone: input.emergencyPhone.trim(),
    p_photo_ok: input.photoOk,
    p_signed_name: input.signedName.trim(),
    p_guardian_name: input.isMinor ? input.guardianName.trim() : null,
    p_guardian_relationship: input.isMinor ? input.guardianRelationship.trim() : null,
    p_email_opt_in: input.joinList,
    p_ip: ip,
    p_user_agent: h.get("user-agent") ?? "",
  });
  if (error || !data) {
    console.error("[popup/sign] rpc failed:", error?.code ?? "no data");
    return { ok: false, error: "Something went wrong. Try again, or sign the paper copy." };
  }
  const res = data as { ok: boolean; here?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: ERRORS[res.error ?? "invalid"] ?? ERRORS.invalid };
  return { ok: true, here: !!res.here };
}
