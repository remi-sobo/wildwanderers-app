import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type CoachShareTone = "note" | "training" | "lesson" | "win" | "tough_day";
export type CoachShareAudience = "everyone" | "clients";

export type CoachShare = {
  id: string;
  tone: CoachShareTone;
  title: string | null;
  body: string;
  training_note: string | null;
  media_url: string | null;
  audience: CoachShareAudience;
  status: "draft" | "published";
  published_at: string | null;
  ack_count: number;
  created_at: string;
};

const COLUMNS =
  "id, tone, title, body, training_note, media_url, audience, status, published_at, ack_count, created_at";

// Staff view: every share in the org, drafts included, newest first. RLS scopes
// it to the org and to owner/coach.
export async function getManagedShares(): Promise<CoachShare[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_shares")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  return (data as CoachShare[] | null) ?? [];
}

// A single share for the edit screen. Null if not in the caller's org (RLS) or
// gone.
export async function getShare(id: string): Promise<CoachShare | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("coach_shares").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as CoachShare | null) ?? null;
}

export type FeedShare = CoachShare & { acked: boolean };

// The member feed (client or family): published shares they may see, by RLS,
// each carrying whether the current person has already acked it.
export async function getCoachFeed(limit = 20): Promise<FeedShare[]> {
  const supabase = await createClient();
  const session = await getSessionProfile();
  const uid = session?.userId ?? null;

  const { data } = await supabase
    .from("coach_shares")
    .select(COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  const shares = (data as CoachShare[] | null) ?? [];
  if (shares.length === 0 || !uid) return shares.map((s) => ({ ...s, acked: false }));

  const { data: acks } = await supabase
    .from("coach_share_acks")
    .select("share_id")
    .eq("profile_id", uid)
    .in(
      "share_id",
      shares.map((s) => s.id),
    );
  const mine = new Set(((acks as { share_id: string }[] | null) ?? []).map((a) => a.share_id));
  return shares.map((s) => ({ ...s, acked: mine.has(s.id) }));
}

// The latest published share for the Home "From your coach" card.
export async function getLatestCoachShare(): Promise<FeedShare | null> {
  const feed = await getCoachFeed(1);
  return feed[0] ?? null;
}

// A light cadence signal for the coach: how many weeks in a row he has shared,
// so the surface can hold him to it. Counts distinct ISO weeks of published
// shares back from this week with no gap.
export async function getCoachCadence(): Promise<{ total: number; weekStreak: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_shares")
    .select("published_at")
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(200);
  const rows = (data as { published_at: string }[] | null) ?? [];
  const total = rows.length;
  if (total === 0) return { total: 0, weekStreak: 0 };

  // Monday-anchored week index, so "this week" and "last week" are adjacent.
  const weekOf = (iso: string): number => {
    const d = new Date(iso);
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
    return Math.floor(monday / (7 * 24 * 60 * 60 * 1000));
  };
  const weeks = new Set(rows.map((r) => weekOf(r.published_at)));
  const now = new Date().toISOString();
  const thisWeek = weekOf(now);
  // Allow the streak to count from this week or last week (a note mid-week).
  let cursor = weeks.has(thisWeek) ? thisWeek : thisWeek - 1;
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor--;
  }
  return { total, weekStreak: streak };
}
