import "server-only";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { auditLog } from "@/lib/audit/log";

// The pop-up roll call (specs/popup-roll-call.md). Owner-only reads; owner
// RLS on every popup_* table is the real boundary, requireOwner is the door.

export type PopupDay = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  here: number;
  free: number;
};

export async function getPopupDays(): Promise<PopupDay[]> {
  const supabase = await createClient();
  const [{ data: days }, { data: att }] = await Promise.all([
    supabase.from("popup_days").select("id, starts_at, ends_at, location").order("starts_at", { ascending: true }),
    supabase.from("popup_attendance").select("popup_day_id, free_session"),
  ]);
  const here = new Map<string, number>();
  const free = new Map<string, number>();
  for (const a of (att ?? []) as { popup_day_id: string; free_session: boolean }[]) {
    here.set(a.popup_day_id, (here.get(a.popup_day_id) ?? 0) + 1);
    if (a.free_session) free.set(a.popup_day_id, (free.get(a.popup_day_id) ?? 0) + 1);
  }
  return ((days ?? []) as Omit<PopupDay, "here" | "free">[]).map((d) => ({
    ...d,
    here: here.get(d.id) ?? 0,
    free: free.get(d.id) ?? 0,
  }));
}

export type WaiverRecord = {
  signed_via: "self" | "paper";
  signed_at: string;
  signed_name: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  photo_ok: boolean | null;
};

// One line on the roll. A person on the pop-up list who has never come or
// signed has no guest record yet (guestId null); tapping Here creates it.
export type RollRow = {
  key: string;
  guestId: string | null;
  subscriberId: string | null;
  name: string;
  email: string;
  phone: string | null;
  age: number | null;
  here: boolean;
  broughtBy: string | null;
  free: boolean;
  friends: number;
  waiver: WaiverRecord | null;
};

export type RollCall = {
  day: { id: string; starts_at: string; ends_at: string | null; location: string | null; sign_token: string };
  rows: RollRow[];
  onList: number;
  waiverReady: boolean;
  signUrl: string;
  signQrSvg: string;
};

const DEFAULT_APP_URL = "https://app.wildwanderers.life";

export async function getRollCall(dayId: string): Promise<RollCall | null> {
  const { userId, profile } = await requireOwner();
  const supabase = await createClient();

  const { data: day } = await supabase
    .from("popup_days")
    .select("id, starts_at, ends_at, location, sign_token")
    .eq("id", dayId)
    .maybeSingle();
  if (!day) return null;

  const [{ data: form }, { data: subs }, { data: guests }, { data: att }] = await Promise.all([
    supabase
      .from("forms")
      .select("id, version, valid_through")
      .eq("kind", "popup_waiver")
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("library_subscribers").select("id, email, name, phone").eq("source", "saturday"),
    supabase.from("popup_guests").select("id, full_name, email, phone, age_if_minor, subscriber_id"),
    supabase.from("popup_attendance").select("guest_id, brought_by, free_session").eq("popup_day_id", dayId),
  ]);

  // Only a signature on the current version counts; a new version re-prompts.
  const waivers = new Map<string, WaiverRecord>();
  if (form) {
    const { data: ws } = await supabase
      .from("popup_waivers")
      .select(
        "guest_id, signed_via, signed_at, signed_name, guardian_name, guardian_relationship, emergency_name, emergency_phone, photo_ok",
      )
      .eq("form_id", form.id)
      .eq("form_version", form.version);
    for (const w of (ws ?? []) as (WaiverRecord & { guest_id: string })[]) {
      const { guest_id, ...rest } = w;
      waivers.set(guest_id, rest);
    }
  }

  const attendance = new Map<string, { brought_by: string | null; free_session: boolean }>();
  const friends = new Map<string, number>();
  for (const a of (att ?? []) as { guest_id: string; brought_by: string | null; free_session: boolean }[]) {
    attendance.set(a.guest_id, a);
    if (a.brought_by) friends.set(a.brought_by, (friends.get(a.brought_by) ?? 0) + 1);
  }

  type G = { id: string; full_name: string; email: string; phone: string | null; age_if_minor: number | null; subscriber_id: string | null };
  const guestRows = (guests ?? []) as G[];
  const linked = new Set(guestRows.map((g) => g.subscriber_id).filter(Boolean));

  const rows: RollRow[] = guestRows.map((g) => {
    const a = attendance.get(g.id);
    return {
      key: `g:${g.id}`,
      guestId: g.id,
      subscriberId: g.subscriber_id,
      name: g.full_name,
      email: g.email,
      phone: g.phone,
      age: g.age_if_minor,
      here: !!a,
      broughtBy: a?.brought_by ?? null,
      free: a?.free_session ?? false,
      friends: friends.get(g.id) ?? 0,
      waiver: waivers.get(g.id) ?? null,
    };
  });
  for (const s of (subs ?? []) as { id: string; email: string; name: string | null; phone: string | null }[]) {
    if (linked.has(s.id)) continue;
    rows.push({
      key: `s:${s.id}`,
      guestId: null,
      subscriberId: s.id,
      name: s.name ?? "",
      email: s.email,
      phone: s.phone,
      age: null,
      here: false,
      broughtBy: null,
      free: false,
      friends: 0,
      waiver: null,
    });
  }
  rows.sort((x, y) => (x.name || x.email).localeCompare(y.name || y.email, undefined, { sensitivity: "base" }));

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const signUrl = `${appUrl}/popup/sign/${day.sign_token}`;
  const signQrSvg = await QRCode.toString(signUrl, { type: "svg", margin: 1, color: { dark: "#1e331f", light: "#fdfbf5" } });

  // Emergency contacts and minors' ages are on this screen: log the access.
  void auditLog({
    actorId: userId,
    orgId: profile.org_id,
    action: "popup.roll.view",
    entityTable: "popup_days",
    entityId: day.id,
  });

  return {
    day: day as RollCall["day"],
    rows,
    onList: (subs ?? []).length,
    waiverReady: !!form,
    signUrl,
    signQrSvg,
  };
}
