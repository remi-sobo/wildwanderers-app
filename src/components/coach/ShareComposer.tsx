"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, X, Sparkles } from "lucide-react";
import { createShare, updateShare, type ShareForm } from "@/lib/coach-shares/actions";
import { draftCoachShare } from "@/lib/ai/coach-actions";

export type ShareInitial = {
  id: string;
  tone: string;
  title: string;
  body: string;
  trainingNote: string;
  audience: "everyone" | "clients";
  mediaUrl: string | null;
  status: "draft" | "published";
};

const EMPTY: ShareInitial = {
  id: "",
  tone: "note",
  title: "",
  body: "",
  trainingNote: "",
  audience: "everyone",
  mediaUrl: null,
  status: "draft",
};

const TONE_OPTIONS = [
  { value: "note", label: "A note" },
  { value: "training", label: "Training" },
  { value: "lesson", label: "A lesson" },
  { value: "win", label: "A win" },
  { value: "tough_day", label: "A tough day" },
];

const AUDIENCE_OPTIONS = [
  { value: "everyone", label: "Clients and families", hint: "Everyone you work with" },
  { value: "clients", label: "Clients only", hint: "Not the boys' families" },
];

const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.01em] text-ink";
const cardClass =
  "rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function ShareComposer({
  mode,
  initial,
  coachConfigured,
}: {
  mode: "create" | "edit";
  initial?: ShareInitial;
  coachConfigured: boolean;
}) {
  const router = useRouter();
  const start = initial ?? EMPTY;

  const [tone, setTone] = useState(start.tone);
  const [title, setTitle] = useState(start.title);
  const [body, setBody] = useState(start.body);
  const [trainingNote, setTrainingNote] = useState(start.trainingNote);
  const [audience, setAudience] = useState<"everyone" | "clients">(start.audience);

  const [photoUrl, setPhotoUrl] = useState<string | null>(start.mediaUrl);
  const [photoData, setPhotoData] = useState<{ data: string; mime: string } | null>(null);
  const [photoCleared, setPhotoCleared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [drafting, startDraft] = useTransition();
  const [draftNote, setDraftNote] = useState<string | null>(null);

  function form(): ShareForm {
    return { tone, title, body, trainingNote, audience };
  }

  function runDraft() {
    setDraftNote(null);
    setError(null);
    startDraft(async () => {
      const res = await draftCoachShare({ tone, title, note: body, trainingNote });
      if (res.error || !res.text) {
        setDraftNote(res.error ?? "Scout could not draft that.");
        return;
      }
      setBody(res.text);
      setDraftNote("Scout shaped your words. Edit it so it sounds like you before you share.");
    });
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      setPhotoData({ data: dataUrl, mime: file.type });
      setPhotoUrl(dataUrl);
      setPhotoCleared(false);
      setError(null);
    } catch {
      setError("Could not read that image.");
    }
  }

  function clearPhoto() {
    setPhotoData(null);
    setPhotoUrl(null);
    setPhotoCleared(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  function save(publish: boolean) {
    setError(null);
    startSave(async () => {
      const payload = { form: form(), cover: photoData, publish };
      const res =
        mode === "edit" && start.id
          ? await updateShare(start.id, { ...payload, clearCover: photoCleared })
          : await createShare(payload);
      if (!res.ok) {
        setError(res.error ?? "Could not save that.");
        return;
      }
      router.push("/alongside");
      router.refresh();
    });
  }

  const isPublished = mode === "edit" && start.status === "published";

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

      <div className={cardClass}>
        <p className="eyebrow text-bark">Your note</p>
        <div className="mt-4">
          <label htmlFor="tone" className={labelClass}>
            Tone
          </label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  tone === t.value
                    ? "border-forest bg-forest text-bone"
                    : "border-[color:var(--border-strong)] text-[color:var(--color-text-muted)] hover:border-forest"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="title" className={labelClass}>
            Title (optional)
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A few words, if you want one"
            className="ww-input"
          />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="body" className="text-[12.5px] font-semibold tracking-[0.01em] text-ink">
              What you want to share
            </label>
            {coachConfigured ? (
              <button
                type="button"
                onClick={runDraft}
                disabled={drafting}
                className="inline-flex items-center gap-1.5 rounded-full border border-forest/25 bg-forest/5 px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-60"
              >
                <Sparkles size={13} aria-hidden="true" />
                {drafting ? "Shaping" : "Shape with Scout"}
              </button>
            ) : null}
          </div>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="How your week went, what you are working on, an honest word. This is yours, in your voice."
            className="w-full rounded-xl border border-[color:var(--border-strong)] bg-card p-3 text-[14.5px] leading-[1.55] text-ink"
          />
          {draftNote ? (
            <p className="mt-2 text-[12.5px] text-[color:var(--color-text-muted)]">{draftNote}</p>
          ) : null}
          {!coachConfigured ? (
            <p className="mt-2 text-[12px] text-[color:var(--color-text-faint)]">
              Scout can help shape your words here once its key is set in the deployment.
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <label htmlFor="training" className={labelClass}>
            What you moved this week (optional)
          </label>
          <input
            id="training"
            value={trainingNote}
            onChange={(e) => setTrainingNote(e.target.value)}
            placeholder="e.g. Three lifts and a long Saturday hike"
            className="ww-input"
          />
        </div>
      </div>

      <div className={cardClass}>
        <p className="eyebrow text-bark">Who sees it</p>
        <div className="mt-4 flex flex-col gap-1.5">
          {AUDIENCE_OPTIONS.map((a) => (
            <label
              key={a.value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13.5px] transition-colors ${
                audience === a.value
                  ? "border-forest/40 bg-forest/5 text-ink"
                  : "border-[color:var(--border-hair)] text-[color:var(--color-text-muted)] hover:bg-inset"
              }`}
            >
              <input
                type="radio"
                name="audience"
                value={a.value}
                checked={audience === a.value}
                onChange={() => setAudience(a.value as "everyone" | "clients")}
                className="accent-forest"
              />
              <span className="font-semibold">{a.label}</span>
              <span className="text-[11.5px] text-[color:var(--color-text-faint)]">{a.hint}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <p className="eyebrow text-bark">Photo (optional)</p>
        <div className="mt-4 flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Preview" className="h-20 w-32 rounded-lg object-cover" />
          ) : (
            <div className="flex h-20 w-32 items-center justify-center rounded-lg bg-inset text-[color:var(--color-text-faint)]">
              <ImagePlus size={22} aria-hidden="true" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={onPickPhoto}
              className="block text-[13px] text-[color:var(--color-text-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-bone hover:file:bg-forest-deep"
            />
            {photoUrl ? (
              <button
                type="button"
                onClick={clearPhoto}
                className="inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-[color:var(--color-state-error)]"
              >
                <X size={13} aria-hidden="true" /> Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-6 py-2.5 text-[14px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep disabled:opacity-70"
        >
          {saving ? "Saving" : isPublished ? "Save and keep shared" : "Share it"}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full border border-forest/30 px-5 py-2.5 text-[14px] font-semibold text-forest transition-colors hover:bg-forest/5 disabled:opacity-70"
        >
          {isPublished ? "Move to draft" : "Save draft"}
        </button>
        <Link href="/alongside" className="ww-link text-[13.5px] font-semibold text-forest">
          Cancel
        </Link>
      </div>
    </div>
  );
}
