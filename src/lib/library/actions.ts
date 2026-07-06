"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/require-owner";
import { auditLog } from "@/lib/audit/log";
import { slugify } from "@/lib/data/library";
import { isPostCategory } from "@/lib/library/categories";

// The composer's write path. Every action re-checks the caller with
// requireOwner (a hidden button is not a permission), and RLS behind it is the
// real boundary. The owner is the only writer of library content.

const COVER_BUCKET = "library-covers";
const ALLOWED_COVER_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_COVER_BYTES = 6 * 1024 * 1024; // 6MB

export type PostFormResult = { ok: boolean; error: string | null; postId?: string };

type ParsedPost = {
  title: string;
  category: string;
  audience: "public" | "members";
  externalLink: string | null;
  body: string | null;
  isChallenge: boolean;
  challengeWeek: number | null;
};

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  return "jpg";
}

// Pull the shared post fields off the form and validate them. Returns a string
// on the first problem so the action can surface plain copy.
function parsePost(formData: FormData): ParsedPost | string {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const audienceRaw = String(formData.get("audience") ?? "public").trim();
  const externalLink = String(formData.get("external_link") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isChallenge = formData.get("is_challenge") === "on" || formData.get("is_challenge") === "true";
  const weekRaw = String(formData.get("challenge_week") ?? "").trim();

  if (!title) return "Give the post a title.";
  if (!isPostCategory(category)) return "Pick a category.";
  const audience = audienceRaw === "members" ? "members" : "public";
  if (!externalLink && !body) return "Add a link or a short body, so there is something to show.";
  if (externalLink && !/^https?:\/\//i.test(externalLink)) {
    return "The link needs to start with http:// or https://";
  }

  let challengeWeek: number | null = null;
  if (isChallenge) {
    const n = Number(weekRaw);
    if (!Number.isInteger(n) || n < 1) return "A challenge needs a week number.";
    challengeWeek = n;
  }

  return {
    title,
    category,
    audience,
    externalLink: externalLink || null,
    body: body || null,
    isChallenge,
    challengeWeek,
  };
}

// A slug unique within the org. Appends -2, -3, ... past any collision, and
// ignores the row being edited so re-saving a post keeps its slug.
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  title: string,
  excludePostId: string | null,
): Promise<string> {
  const base = slugify(title) || "post";
  const { data } = await supabase.from("posts").select("id, slug");
  const taken = new Set(
    ((data as { id: string; slug: string }[] | null) ?? [])
      .filter((r) => r.id !== excludePostId)
      .map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// Upload a cover image server-side through the admin client after the owner
// check, mirroring the issue-report screenshot upload. Returns the public URL
// (the bucket is public) or an error string.
async function uploadCover(
  orgId: string,
  file: { data: string; mime: string } | null,
): Promise<{ url: string | null; error: string | null }> {
  if (!file) return { url: null, error: null };
  if (!ALLOWED_COVER_MIMES.has(file.mime)) {
    return { url: null, error: "Cover must be a JPG, PNG, WebP, or AVIF image." };
  }
  const b64 = file.data.includes(",") ? file.data.split(",", 2)[1] : file.data;
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0) return { url: null, error: "That cover image was empty." };
  if (buf.length > MAX_COVER_BYTES) return { url: null, error: "Cover image is too big (max 6MB)." };

  const admin = createAdminClient();
  const path = `${orgId}/${crypto.randomUUID()}.${extForMime(file.mime)}`;
  const { error } = await admin.storage
    .from(COVER_BUCKET)
    .upload(path, buf, { contentType: file.mime, upsert: false });
  if (error) return { url: null, error: `Cover upload failed: ${error.message}` };

  const { data } = admin.storage.from(COVER_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// A cover image passed from the client as a data URL. Optional on every save.
type CoverInput = { data: string; mime: string } | null;

// Create a post. `publish` decides draft vs published in one step, so the
// composer's "Save draft" and "Publish" are the same action with a flag.
export async function createPost(
  input: { form: Record<string, string>; cover: CoverInput; publish: boolean },
): Promise<PostFormResult> {
  const { profile } = await requireOwner();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const fd = new FormData();
  for (const [k, v] of Object.entries(input.form)) fd.set(k, v);
  const parsed = parsePost(fd);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const cover = await uploadCover(orgId, input.cover);
  if (cover.error) return { ok: false, error: cover.error };

  const supabase = await createClient();
  const slug = await uniqueSlug(supabase, parsed.title, null);

  const { data, error } = await supabase
    .from("posts")
    .insert({
      org_id: orgId,
      author_id: profile.id,
      title: parsed.title,
      slug,
      category: parsed.category,
      external_link: parsed.externalLink,
      body: parsed.body,
      cover_image_url: cover.url,
      audience: parsed.audience,
      status: input.publish ? "published" : "draft",
      published_at: input.publish ? new Date().toISOString() : null,
      is_challenge: parsed.isChallenge,
      challenge_week: parsed.challengeWeek,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Could not save that post. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId,
    action: input.publish ? "library.publish" : "library.draft",
    entityTable: "posts",
    entityId: data.id,
    metadata: { audience: parsed.audience, category: parsed.category, is_challenge: parsed.isChallenge },
  });

  revalidatePath("/library");
  revalidatePath("/trailhead");
  return { ok: true, error: null, postId: data.id };
}

// Update an existing post. A missing cover leaves the current one in place; a
// new cover replaces the stored URL.
export async function updatePost(
  postId: string,
  input: {
    form: Record<string, string>;
    cover: CoverInput;
    publish: boolean | null;
    clearCover?: boolean;
  },
): Promise<PostFormResult> {
  const { profile } = await requireOwner();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const fd = new FormData();
  for (const [k, v] of Object.entries(input.form)) fd.set(k, v);
  const parsed = parsePost(fd);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("posts")
    .select("id, status, published_at")
    .eq("id", postId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "That post was not found." };
  const current = existing as { status: string; published_at: string | null };

  const cover = await uploadCover(orgId, input.cover);
  if (cover.error) return { ok: false, error: cover.error };

  const slug = await uniqueSlug(supabase, parsed.title, postId);

  // publish: true -> publish now (stamp published_at if not already);
  // false -> back to draft; null -> leave status as it is.
  let status = current.status;
  let publishedAt = current.published_at;
  if (input.publish === true) {
    status = "published";
    publishedAt = current.published_at ?? new Date().toISOString();
  } else if (input.publish === false) {
    status = "draft";
  }

  const patch: Record<string, unknown> = {
    title: parsed.title,
    slug,
    category: parsed.category,
    external_link: parsed.externalLink,
    body: parsed.body,
    audience: parsed.audience,
    status,
    published_at: publishedAt,
    is_challenge: parsed.isChallenge,
    challenge_week: parsed.challengeWeek,
    updated_at: new Date().toISOString(),
  };
  // A new upload replaces the cover; an explicit clear (with no new upload)
  // removes it. Otherwise the stored cover is left as it is.
  if (cover.url) patch.cover_image_url = cover.url;
  else if (input.clearCover) patch.cover_image_url = null;

  const { error } = await supabase.from("posts").update(patch).eq("id", postId);
  if (error) return { ok: false, error: "Could not save that post. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId,
    action: "library.update",
    entityTable: "posts",
    entityId: postId,
    metadata: { status, audience: parsed.audience },
  });

  revalidatePath("/library");
  revalidatePath("/trailhead");
  return { ok: true, error: null, postId };
}

// Flip a post between draft and published from the list, without opening it.
export async function setPostPublished(postId: string, publish: boolean): Promise<PostFormResult> {
  const { profile } = await requireOwner();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("posts")
    .select("published_at")
    .eq("id", postId)
    .maybeSingle();
  const publishedAt =
    (existing as { published_at: string | null } | null)?.published_at ?? new Date().toISOString();

  const { error } = await supabase
    .from("posts")
    .update({
      status: publish ? "published" : "draft",
      published_at: publish ? publishedAt : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) return { ok: false, error: "That did not save. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId: profile.org_id,
    action: publish ? "library.publish" : "library.unpublish",
    entityTable: "posts",
    entityId: postId,
  });

  revalidatePath("/library");
  revalidatePath("/trailhead");
  return { ok: true, error: null, postId };
}

// Delete a post. RLS lets only the owner of the org through. Completions cascade
// with the post (the schema's on delete cascade).
export async function deletePost(postId: string): Promise<PostFormResult> {
  const { profile } = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { ok: false, error: "Could not delete that post. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "library.delete",
    entityTable: "posts",
    entityId: postId,
  });

  revalidatePath("/library");
  revalidatePath("/trailhead");
  return { ok: true, error: null };
}
