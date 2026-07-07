"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import {
  createMovement,
  updateMovement,
  createUploadTicket,
  type MovementForm,
} from "@/lib/exercises/actions";
import { createClient } from "@/lib/supabase/client";
import { VideoEmbed } from "@/components/ui/VideoEmbed";
import { resolveVideo } from "@/lib/media/video";

export type ComposerInitial = {
  id: string;
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

const EMPTY: ComposerInitial = {
  id: "",
  title: "",
  kind: "strength",
  muscleGroup: "",
  equipment: "",
  defaultSets: "",
  defaultReps: "",
  cues: "",
  instructions: "",
  mediaUrl: "",
};

// The movement types, in a sensible working order. Values match the
// exercise_kind enum.
const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Mobility" },
  { value: "warmup", label: "Warm-up" },
  { value: "cooldown", label: "Cool-down" },
  { value: "skill", label: "Skill" },
];

const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.01em] text-ink";
const cardClass =
  "rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]";
const selectClass =
  "h-11 w-full rounded-xl border border-[color:var(--border-strong)] bg-card px-3 text-[14.5px] text-ink";

export function ExerciseComposer({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: ComposerInitial;
}) {
  const router = useRouter();
  const start = initial ?? EMPTY;

  const [title, setTitle] = useState(start.title);
  const [kind, setKind] = useState(start.kind);
  const [muscleGroup, setMuscleGroup] = useState(start.muscleGroup);
  const [equipment, setEquipment] = useState(start.equipment);
  const [defaultSets, setDefaultSets] = useState(start.defaultSets);
  const [defaultReps, setDefaultReps] = useState(start.defaultReps);
  const [cues, setCues] = useState(start.cues);
  const [instructions, setInstructions] = useState(start.instructions);
  const [mediaUrl, setMediaUrl] = useState(start.mediaUrl);

  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = resolveVideo(mediaUrl);
  const linkTyped = mediaUrl.trim() !== "";

  async function onPickClip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const ext = file.name.split(".").pop() ?? "";
    setUploading(true);
    try {
      const ticket = await createUploadTicket(ext, file.size);
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("exercise-media")
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (upErr) {
        setError("That upload did not finish. Try again.");
        return;
      }
      setMediaUrl(ticket.publicUrl);
    } catch {
      setError("That upload did not finish. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function form(): MovementForm {
    return { title, kind, muscleGroup, equipment, defaultSets, defaultReps, cues, instructions, mediaUrl };
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res =
        mode === "edit" && start.id
          ? await updateMovement(start.id, form())
          : await createMovement(form());
      if (!res.ok) {
        setError(res.error ?? "Could not save that movement.");
        return;
      }
      router.push("/fitness/movements");
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] leading-snug text-[color:var(--color-state-error)]"
        >
          {error}
        </p>
      ) : null}

      {/* The movement */}
      <div className={cardClass}>
        <p className="eyebrow text-bark">The movement</p>
        <div className="mt-4">
          <label htmlFor="title" className={labelClass}>
            Name
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Goblet Squat"
            className="ww-input"
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="kind" className={labelClass}>
              Type
            </label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass}>
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="muscle" className={labelClass}>
              Muscle group
            </label>
            <input
              id="muscle"
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              placeholder="Quads and glutes"
              className="ww-input"
            />
          </div>
          <div>
            <label htmlFor="equipment" className={labelClass}>
              Equipment
            </label>
            <input
              id="equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Dumbbell"
              className="ww-input"
            />
          </div>
        </div>
      </div>

      {/* Prescription defaults */}
      <div className={cardClass}>
        <p className="eyebrow text-bark">Defaults and coaching</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sets" className={labelClass}>
              Default sets
            </label>
            <input
              id="sets"
              value={defaultSets}
              onChange={(e) => setDefaultSets(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="3"
              className="ww-input"
            />
          </div>
          <div>
            <label htmlFor="reps" className={labelClass}>
              Default reps
            </label>
            <input
              id="reps"
              value={defaultReps}
              onChange={(e) => setDefaultReps(e.target.value)}
              placeholder="8-10 or 45 seconds"
              className="ww-input"
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="cues" className={labelClass}>
            Coaching cues
          </label>
          <input
            id="cues"
            value={cues}
            onChange={(e) => setCues(e.target.value)}
            placeholder="Short, said mid-set. e.g. Brace, sit tall, drive through mid-foot."
            className="ww-input"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="instructions" className={labelClass}>
            How to do it (optional)
          </label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="A fuller description if the cues are not enough on their own."
            className="w-full rounded-xl border border-[color:var(--border-strong)] bg-card p-3 text-[14.5px] leading-[1.55] text-ink"
          />
        </div>
      </div>

      {/* Demo video */}
      <div className={cardClass}>
        <p className="eyebrow text-bark">Demo video (optional)</p>
        <div className="mt-4">
          <label htmlFor="media" className={labelClass}>
            Video link
          </label>
          <input
            id="media"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Paste a YouTube, Vimeo, or video file link"
            inputMode="url"
            className="ww-input"
          />
          <p className="mt-2 text-[12px] text-[color:var(--color-text-faint)]">
            YouTube and Vimeo links play right in the app.
          </p>
        </div>
        <div className="mt-4 border-t border-[color:var(--border-hair)] pt-4">
          <span className={labelClass}>Or upload your own clip</span>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
              onChange={onPickClip}
              disabled={uploading}
              className="block text-[13px] text-[color:var(--color-text-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-bone hover:file:bg-forest-deep disabled:opacity-60"
            />
            {uploading ? (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-forest">
                <UploadCloud size={14} aria-hidden="true" /> Uploading
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[12px] text-[color:var(--color-text-faint)]">
            MP4, WebM, or MOV, up to 200MB. It uploads and fills the link above.
          </p>
        </div>
        {linkTyped ? (
          <div className="mt-4">
            {preview.kind === "link" || preview.kind === "none" ? (
              <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                {preview.kind === "none"
                  ? "That does not look like a full link yet."
                  : "This will show as a link. YouTube, Vimeo, or a direct video file play inline."}
              </p>
            ) : (
              <VideoEmbed url={mediaUrl} title={title || "Movement demo"} />
            )}
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-6 py-2.5 text-[14px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep disabled:opacity-70"
        >
          {saving ? "Saving" : mode === "edit" ? "Save movement" : "Add movement"}
        </button>
        <Link href="/fitness/movements" className="ww-link text-[13.5px] font-semibold text-forest">
          Cancel
        </Link>
      </div>
    </div>
  );
}
