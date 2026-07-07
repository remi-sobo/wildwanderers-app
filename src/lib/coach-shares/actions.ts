"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { auditLog } from "@/lib/audit/log";
import type { CoachShareTone, CoachShareAudience } from "@/lib/data/coach-shares";

// The Alongside write path. Staff (owner+coach) compose; every action re-checks
// the caller and RLS is the real boundary. Members only toggle their own ack.

const MEDIA_BUCKET = "coach-media";
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_PHOTO_BYTES = 6 * 1024 * 1024; // 6MB
const TONES: CoachShareTone[] = ["note", "training", "lesson", "win", "tough_day"];

export type ShareResult = { ok: boolean; error: string | null; shareId?: string };
export type CoverInput = { data: string; mime: string } | null;

export type ShareForm = {
  tone: string;
  title: string;
  body: string;
  trainingNote: string;
  audience: string;
};

type ParsedShare = {
  tone: CoachShareTone;
  title: string | null;
  body: string;
  training_note: string | null;
  audience: CoachShareAudience;
};

function orNull(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function parseShare(form: ShareForm): ParsedShare | string {
  const body = (form.body ?? "").trim();
  if (!body) return "Write a few words before you share.";
  if (body.length > 5000) return "That note is very long. Trim it a little.";
  const tone = (form.tone ?? "note").trim() as CoachShareTone;
  if (!TONES.includes(tone)) return "Pick a tone.";
  const audience: CoachShareAudience = form.audience === "clients" ? "clients" : "everyone";
  return { tone, title: orNull(form.title), body, training_note: orNull(form.trainingNote), audience };
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  return "jpg";
}

// Upload a share photo server-side through the admin client after the staff
// check, mirroring the Trailhead cover upload. Returns the public URL.
async function uploadPhoto(
  orgId: string,
  file: CoverInput,
): Promise<{ url: string | null; error: string | null }> {
  if (!file) return { url: null, error: null };
  if (!ALLOWED_MIMES.has(file.mime)) return { url: null, error: "Photo must be a JPG, PNG, WebP, or AVIF." };
  const b64 = file.data.includes(",") ? file.data.split(",", 2)[1] : file.data;
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0) return { url: null, error: "That photo was empty." };
  if (buf.length > MAX_PHOTO_BYTES) return { url: null, error: "Photo is too big (max 6MB)." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { url: null, error: "Photo upload is not set up yet. Save without one for now." };
  }
  const admin = createAdminClient();
  const path = `${orgId}/${crypto.randomUUID()}.${extForMime(file.mime)}`;
  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, buf, {
    contentType: file.mime,
    upsert: false,
  });
  if (error) return { url: null, error: `Photo upload failed: ${error.message}` };
  const { data } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

function refresh() {
  revalidatePath("/alongside");
  revalidatePath("/home");
  revalidatePath("/family");
}

export async function createShare(input: {
  form: ShareForm;
  cover: CoverInput;
  publish: boolean;
}): Promise<ShareResult> {
  const { profile } = await requireOwnerOrCoach();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const parsed = parseShare(input.form);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const photo = await uploadPhoto(orgId, input.cover);
  if (photo.error) return { ok: false, error: photo.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_shares")
    .insert({
      org_id: orgId,
      author_id: profile.id,
      ...parsed,
      media_url: photo.url,
      status: input.publish ? "published" : "draft",
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not save that note. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId,
    action: input.publish ? "coach_share.publish" : "coach_share.draft",
    entityTable: "coach_shares",
    entityId: data.id,
    metadata: { tone: parsed.tone, audience: parsed.audience, has_photo: photo.url !== null },
  });

  refresh();
  return { ok: true, error: null, shareId: data.id };
}

export async function updateShare(
  id: string,
  input: { form: ShareForm; cover: CoverInput; publish: boolean | null; clearCover?: boolean },
): Promise<ShareResult> {
  const { profile } = await requireOwnerOrCoach();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const parsed = parseShare(input.form);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("coach_shares")
    .select("status, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "That note was not found." };
  const current = existing as { status: string; published_at: string | null };

  const photo = await uploadPhoto(orgId, input.cover);
  if (photo.error) return { ok: false, error: photo.error };

  let status = current.status;
  let publishedAt = current.published_at;
  if (input.publish === true) {
    status = "published";
    publishedAt = current.published_at ?? new Date().toISOString();
  } else if (input.publish === false) {
    status = "draft";
  }

  const patch: Record<string, unknown> = {
    ...parsed,
    status,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  };
  if (photo.url) patch.media_url = photo.url;
  else if (input.clearCover) patch.media_url = null;

  const { error } = await supabase.from("coach_shares").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Could not save that note. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId,
    action: "coach_share.update",
    entityTable: "coach_shares",
    entityId: id,
    metadata: { tone: parsed.tone, audience: parsed.audience, status },
  });

  refresh();
  return { ok: true, error: null, shareId: id };
}

export async function setSharePublished(id: string, publish: boolean): Promise<ShareResult> {
  const { profile } = await requireOwnerOrCoach();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("coach_shares")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  const publishedAt =
    (existing as { published_at: string | null } | null)?.published_at ?? new Date().toISOString();

  const { error } = await supabase
    .from("coach_shares")
    .update({
      status: publish ? "published" : "draft",
      published_at: publish ? publishedAt : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "That did not save. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId: profile.org_id,
    action: publish ? "coach_share.publish" : "coach_share.unpublish",
    entityTable: "coach_shares",
    entityId: id,
  });

  refresh();
  return { ok: true, error: null, shareId: id };
}

export async function deleteShare(id: string): Promise<ShareResult> {
  const { profile } = await requireOwnerOrCoach();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_shares").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete that note. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "coach_share.delete",
    entityTable: "coach_shares",
    entityId: id,
  });

  refresh();
  return { ok: true, error: null };
}

// A client or family toggles their own wordless "walking with you". Returns the
// new state so the button can settle without a full reload.
export async function toggleAck(shareId: string): Promise<{ ok: boolean; acked: boolean; error: string | null }> {
  const session = await getSessionProfile();
  if (!session?.profile) return { ok: false, acked: false, error: "Please sign in again." };
  const { profile, userId } = session;
  if (profile.role !== "client" && profile.role !== "parent") {
    return { ok: false, acked: false, error: "Only clients and families can do that." };
  }
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, acked: false, error: "Your account is not attached to an org yet." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("coach_share_acks")
    .select("id")
    .eq("share_id", shareId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("coach_share_acks").delete().eq("id", (existing as { id: string }).id);
    if (error) return { ok: false, acked: true, error: "That did not save. Try again." };
    refresh();
    return { ok: true, acked: false, error: null };
  }

  const { error } = await supabase
    .from("coach_share_acks")
    .insert({ org_id: orgId, share_id: shareId, profile_id: userId });
  if (error) return { ok: false, acked: false, error: "That did not save. Try again." };
  refresh();
  return { ok: true, acked: true, error: null };
}
