import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import type { Post } from "@/lib/data/library";

// The reader side of the Trailhead Library, shared by clients and families. RLS
// does the filtering: the anon and member policies mean a plain select of
// published posts already returns exactly what this viewer may see (public
// always, member posts only for signed-in members). No audience filter here;
// the database is the boundary.

const FEED_COLUMNS =
  "id, org_id, author_id, title, slug, category, external_link, body, cover_image_url, audience, status, published_at, is_challenge, challenge_week, completion_count, created_at, updated_at";

export type TrailheadData = {
  posts: Post[];
  challenge: Post | null;
  completedPostIds: string[];
  canComplete: boolean; // only a fitness client can mark a challenge done
};

// Everything the reader page needs, in one pass.
export async function getTrailheadData(): Promise<TrailheadData> {
  const supabase = await createClient();
  const session = await getSessionProfile();
  const role = session?.profile?.role;

  const { data } = await supabase
    .from("posts")
    .select(FEED_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const posts = (data as Post[] | null) ?? [];

  // The current weekly challenge: the most recent published challenge the
  // viewer can see. Non-challenge posts fill the grid below it.
  const challenge = posts.find((p) => p.is_challenge) ?? null;

  // A client can mark the challenge done; a family reads only. RLS returns only
  // the caller's own completions, so this list is always just theirs.
  let completedPostIds: string[] = [];
  const canComplete = role === "client";
  if (canComplete) {
    const { data: mine } = await supabase
      .from("post_challenge_completions")
      .select("post_id");
    completedPostIds = ((mine as { post_id: string }[] | null) ?? []).map((r) => r.post_id);
  }

  return { posts, challenge, completedPostIds, canComplete };
}
