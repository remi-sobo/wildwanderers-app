import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

// The owner's view of the Trailhead Library: every post in the org, drafts
// included. RLS (owner_manages_posts) already scopes this to the owner's org,
// so the queries here carry no org filter of their own; the database is the
// boundary.

export type Post = {
  id: string;
  org_id: string;
  author_id: string | null;
  title: string;
  slug: string;
  category: string;
  external_link: string | null;
  body: string | null;
  cover_image_url: string | null;
  audience: "public" | "members";
  status: "draft" | "published";
  published_at: string | null;
  is_challenge: boolean;
  challenge_week: number | null;
  completion_count: number;
  email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

const POST_COLUMNS =
  "id, org_id, author_id, title, slug, category, external_link, body, cover_image_url, audience, status, published_at, is_challenge, challenge_week, completion_count, email_sent_at, created_at, updated_at";

// All posts, newest first, drafts and published together. Owner only by RLS.
export async function getOwnerPosts(): Promise<Post[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .order("status", { ascending: true }) // 'draft' before 'published'
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  return (data as Post[] | null) ?? [];
}

export async function getPostById(id: string): Promise<Post | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as Post | null) ?? null;
}

// The most recent published post, if any. Drives the "current weekly challenge"
// pick (Commit 3) and the cadence nudge below.
export async function getLatestPublishedAt(): Promise<Date | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("published_at")
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const at = (data as { published_at: string | null } | null)?.published_at;
  return at ? new Date(at) : null;
}

export type Cadence = {
  lastPublishedAt: Date | null;
  daysSince: number | null;
  postedThisWeek: boolean;
  everPublished: boolean;
};

// The weekly rhythm behind the nudge: has Gabe published in the last seven days?
// A gentle prompt, never a scold. No fabricated streaks; this is real dates only.
export async function getPublishingCadence(): Promise<Cadence> {
  const last = await getLatestPublishedAt();
  if (!last) {
    return { lastPublishedAt: null, daysSince: null, postedThisWeek: false, everPublished: false };
  }
  const days = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  return {
    lastPublishedAt: last,
    daysSince: days,
    postedThisWeek: days < 7,
    everPublished: true,
  };
}

// A url-safe slug from a title. Non-unique on its own; the caller disambiguates
// against the org's existing slugs (posts is unique on (org_id, slug)).
export function slugify(input: string): string {
  // NFKD splits accented letters into base + combining mark; the alphanumeric
  // filter below then drops the marks, so "Café" becomes "cafe" cleanly.
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// True when the caller is the signed-in owner. Cheap guard for the read pages;
// the write actions and RLS are the real enforcement.
export async function isOwner(): Promise<boolean> {
  const session = await getSessionProfile();
  return session?.profile?.role === "owner";
}
