"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { auditLog } from "@/lib/audit/log";
import type { ExerciseKind } from "@/lib/data/plans";

const MEDIA_BUCKET = "exercise-media";
const ALLOWED_VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v"]);
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB, plenty for a short demo

// The Movements manager write path. Every action re-checks the caller with
// requireOwnerOrCoach (a hidden button is not a permission); RLS on
// exercise_library (owner+coach manage, scoped to org) is the real boundary.

export type MovementResult = { ok: boolean; error: string | null; movementId?: string };

const KINDS: ExerciseKind[] = ["strength", "cardio", "mobility", "warmup", "cooldown", "skill"];

// The editable fields, as strings off the composer. Blanks become null.
export type MovementForm = {
  title: string;
  kind: string;
  muscleGroup: string;
  equipment: string;
  defaultSets: string;
  defaultReps: string;
  cues: string;
  instructions: string;
  mediaUrl: string;
};

type ParsedMovement = {
  title: string;
  kind: ExerciseKind;
  muscle_group: string | null;
  equipment: string | null;
  default_sets: number | null;
  default_reps: string | null;
  cues: string | null;
  instructions: string | null;
  media_url: string | null;
};

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}
function orNull(v: string | undefined): string | null {
  const t = clean(v);
  return t === "" ? null : t;
}

function parseMovement(form: MovementForm): ParsedMovement | string {
  const title = clean(form.title);
  if (!title) return "Give the movement a name.";
  if (title.length > 120) return "That name is too long.";

  const kind = clean(form.kind) as ExerciseKind;
  if (!KINDS.includes(kind)) return "Pick a movement type.";

  let default_sets: number | null = null;
  const setsRaw = clean(form.defaultSets);
  if (setsRaw !== "") {
    const n = Number(setsRaw);
    if (!Number.isInteger(n) || n < 0 || n > 99) return "Default sets should be a small whole number.";
    default_sets = n;
  }

  const mediaUrl = orNull(form.mediaUrl);
  if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) {
    return "The video link needs to start with http:// or https://";
  }

  return {
    title,
    kind,
    muscle_group: orNull(form.muscleGroup),
    equipment: orNull(form.equipment),
    default_sets,
    default_reps: orNull(form.defaultReps),
    cues: orNull(form.cues),
    instructions: orNull(form.instructions),
    media_url: mediaUrl,
  };
}

function refresh() {
  revalidatePath("/fitness/movements");
}

export type UploadTicket =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string };

// Mint a one-time signed upload URL so a clip goes straight from the browser to
// Storage, never through a server-action body limit. Staff-only, and bound to
// the caller's org folder. The composer uploads to it, then saves the returned
// public URL as the movement's media_url. Degrades to a clear message when the
// service key is not set in the deployment.
export async function createUploadTicket(ext: string, sizeBytes: number): Promise<UploadTicket> {
  const { profile } = await requireOwnerOrCoach();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const clean = ext.replace(/^\./, "").toLowerCase();
  if (!ALLOWED_VIDEO_EXT.has(clean)) {
    return { ok: false, error: "Upload an MP4, WebM, or MOV clip." };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: "That file looked empty." };
  }
  if (sizeBytes > MAX_VIDEO_BYTES) {
    return { ok: false, error: "That clip is over 200MB. Trim it or link it from YouTube instead." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Uploads are not set up yet. Paste a YouTube or Vimeo link for now." };
  }

  const admin = createAdminClient();
  const path = `${orgId}/${crypto.randomUUID()}.${clean}`;
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Could not start the upload. Try again." };

  const { data: pub } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, path: data.path, token: data.token, publicUrl: pub.publicUrl };
}

export async function createMovement(form: MovementForm): Promise<MovementResult> {
  const { profile } = await requireOwnerOrCoach();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const parsed = parseMovement(form);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const supabase = await createClient();
  // New movements sort to the top (0) until arranged, the "add it, then place
  // it" flow the seed backfill preserves.
  const { data, error } = await supabase
    .from("exercise_library")
    .insert({ org_id: orgId, created_by: profile.id, sort_order: 0, is_active: true, ...parsed })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "A movement with that name already exists." };
    return { ok: false, error: "Could not save that movement. Try again." };
  }

  await auditLog({
    actorId: profile.id,
    orgId,
    action: "movement.create",
    entityTable: "exercise_library",
    entityId: data.id,
    metadata: { kind: parsed.kind, has_media: parsed.media_url !== null },
  });

  refresh();
  return { ok: true, error: null, movementId: data.id };
}

export async function updateMovement(id: string, form: MovementForm): Promise<MovementResult> {
  const { profile } = await requireOwnerOrCoach();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, error: "Your account is not attached to an org yet." };

  const parsed = parseMovement(form);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercise_library")
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "A movement with that name already exists." };
    return { ok: false, error: "Could not save that movement. Try again." };
  }

  await auditLog({
    actorId: profile.id,
    orgId,
    action: "movement.update",
    entityTable: "exercise_library",
    entityId: id,
    metadata: { kind: parsed.kind, has_media: parsed.media_url !== null },
  });

  refresh();
  return { ok: true, error: null, movementId: id };
}

// Retire (hide from the picker and client) or restore, without deleting, so a
// movement referenced by past plans keeps its link.
export async function setMovementActive(id: string, active: boolean): Promise<MovementResult> {
  const { profile } = await requireOwnerOrCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("exercise_library")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "That did not save. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId: profile.org_id,
    action: active ? "movement.restore" : "movement.retire",
    entityTable: "exercise_library",
    entityId: id,
  });

  refresh();
  return { ok: true, error: null, movementId: id };
}

// Delete only when nothing references it. A referenced movement is retired
// instead (the caller is told to), so plan history never loses its link.
export async function deleteMovement(id: string): Promise<MovementResult> {
  const { profile } = await requireOwnerOrCoach();
  const supabase = await createClient();

  const { count } = await supabase
    .from("workout_exercises")
    .select("id", { count: "exact", head: true })
    .eq("library_item_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This movement is used in a plan. Retire it instead so past plans keep it.",
    };
  }

  const { error } = await supabase.from("exercise_library").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete that movement. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "movement.delete",
    entityTable: "exercise_library",
    entityId: id,
  });

  refresh();
  return { ok: true, error: null };
}

// Persist a new arrangement. orderedIds is the movements in the order Gabe set;
// each row's sort_order becomes its index. RLS scopes every write to the org.
export async function reorderMovements(orderedIds: string[]): Promise<MovementResult> {
  const { profile } = await requireOwnerOrCoach();
  const supabase = await createClient();

  const updates = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("exercise_library").update({ sort_order: i + 1 }).eq("id", id),
    ),
  );
  if (updates.some((u) => u.error)) return { ok: false, error: "Could not save the new order. Try again." };

  await auditLog({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "movement.reorder",
    entityTable: "exercise_library",
    metadata: { count: orderedIds.length },
  });

  refresh();
  return { ok: true, error: null };
}
