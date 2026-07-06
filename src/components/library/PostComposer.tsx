"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ImagePlus, X } from "lucide-react";
import { createPost, updatePost } from "@/lib/library/actions";
import { draftPostBlurb } from "@/lib/ai/coach-actions";
import { POST_CATEGORIES, POST_AUDIENCES } from "@/lib/library/categories";

export type ComposerInitial = {
  id: string;
  title: string;
  category: string;
  audience: "public" | "members";
  externalLink: string;
  body: string;
  coverUrl: string | null;
  status: "draft" | "published";
  isChallenge: boolean;
  challengeWeek: number | null;
};

const EMPTY: ComposerInitial = {
  id: "",
  title: "",
  category: POST_CATEGORIES[0].value,
  audience: "public",
  externalLink: "",
  body: "",
  coverUrl: null,
  status: "draft",
  isChallenge: false,
  challengeWeek: null,
};

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

export function PostComposer({
  mode,
  initial,
  coachConfigured,
}: {
  mode: "create" | "edit";
  initial?: ComposerInitial;
  coachConfigured: boolean;
}) {
  const router = useRouter();
  const start = initial ?? EMPTY;

  const [title, setTitle] = useState(start.title);
  const [category, setCategory] = useState(start.category);
  const [audience, setAudience] = useState<"public" | "members">(start.audience);
  const [externalLink, setExternalLink] = useState(start.externalLink);
  const [body, setBody] = useState(start.body);
  const [isChallenge, setIsChallenge] = useState(start.isChallenge);
  const [challengeWeek, setChallengeWeek] = useState(
    start.challengeWeek != null ? String(start.challengeWeek) : "",
  );

  // Cover: keep the existing URL for display, and the newly picked data URL for
  // upload. A new pick replaces the old on save.
  const [coverUrl, setCoverUrl] = useState<string | null>(start.coverUrl);
  const [coverData, setCoverData] = useState<{ data: string; mime: string } | null>(null);
  const [coverCleared, setCoverCleared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [blurbNote, setBlurbNote] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [blurbing, startBlurb] = useTransition();

  function form(): Record<string, string> {
    return {
      title,
      category,
      audience,
      external_link: externalLink,
      body,
      is_challenge: isChallenge ? "true" : "false",
      challenge_week: challengeWeek,
    };
  }

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      setCoverData({ data: dataUrl, mime: file.type });
      setCoverUrl(dataUrl);
      setCoverCleared(false);
      setError(null);
    } catch {
      setError("Could not read that image.");
    }
  }

  function clearCover() {
    setCoverData(null);
    setCoverUrl(null);
    setCoverCleared(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  function runBlurb() {
    setBlurbNote(null);
    setError(null);
    startBlurb(async () => {
      const res = await draftPostBlurb({
        link: externalLink,
        title,
        note: body,
        category,
      });
      if (res.error || !res.text) {
        setBlurbNote(res.error ?? "Coach could not draft that.");
        return;
      }
      setBody(res.text);
      setBlurbNote("Coach drafted a blurb. Edit it to sound like you before publishing.");
    });
  }

  function save(publish: boolean) {
    setError(null);
    startSave(async () => {
      const payload = { form: form(), cover: coverData, publish };
      const res =
        mode === "edit" && start.id
          ? await updatePost(start.id, { ...payload, clearCover: coverCleared })
          : await createPost(payload);
      if (!res.ok) {
        setError(res.error ?? "Could not save that.");
        return;
      }
      router.push("/library");
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

      {/* The post */}
      <div className={cardClass}>
        <p className="eyebrow text-bark">The post</p>
        <div className="mt-4">
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A question works well, e.g. What does a rest week actually do?"
            className="ww-input"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="external_link" className={labelClass}>
            Link (optional)
          </label>
          <input
            id="external_link"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            placeholder="https://"
            inputMode="url"
            className="ww-input"
          />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="body" className="text-[12.5px] font-semibold tracking-[0.01em] text-ink">
              Short body (optional)
            </label>
            {coachConfigured ? (
              <button
                type="button"
                onClick={runBlurb}
                disabled={blurbing}
                className="inline-flex items-center gap-1.5 rounded-full border border-forest/25 bg-forest/5 px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-60"
              >
                <Sparkles size={13} aria-hidden="true" />
                {blurbing ? "Drafting" : "Draft a blurb with Coach"}
              </button>
            ) : null}
          </div>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="A sentence or two. What it is, why it is worth their time."
            className="w-full rounded-xl border border-[color:var(--border-strong)] bg-card p-3 text-[14.5px] leading-[1.55] text-ink"
          />
          {blurbNote ? (
            <p className="mt-2 text-[12.5px] text-[color:var(--color-text-muted)]">{blurbNote}</p>
          ) : null}
          {!coachConfigured ? (
            <p className="mt-2 text-[12px] text-[color:var(--color-text-faint)]">
              Coach can draft a blurb here once its key is set in the deployment.
            </p>
          ) : null}
        </div>
      </div>

      {/* Filing */}
      <div className={cardClass}>
        <p className="eyebrow text-bark">Filing</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelClass}>
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-xl border border-[color:var(--border-strong)] bg-card px-3 text-[14.5px] text-ink"
            >
              {POST_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelClass}>Audience</span>
            <div className="flex flex-col gap-1.5">
              {POST_AUDIENCES.map((a) => (
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
                    onChange={() => setAudience(a.value)}
                    className="accent-forest"
                  />
                  <span className="font-semibold">{a.label}</span>
                  <span className="text-[11.5px] text-[color:var(--color-text-faint)]">{a.hint}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly challenge */}
        <div className="mt-5 rounded-xl bg-inset/60 p-4">
          <label className="flex items-center gap-2.5 text-[13.5px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={isChallenge}
              onChange={(e) => setIsChallenge(e.target.checked)}
              className="h-4 w-4 accent-amber"
            />
            Make this the weekly challenge
          </label>
          {isChallenge ? (
            <div className="mt-3 max-w-[180px]">
              <label htmlFor="challenge_week" className="mb-1.5 block text-[12px] text-bark">
                Week number
              </label>
              <input
                id="challenge_week"
                value={challengeWeek}
                onChange={(e) => setChallengeWeek(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="e.g. 28"
                className="ww-input"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Cover */}
      <div className={cardClass}>
        <p className="eyebrow text-bark">Cover image (optional)</p>
        <div className="mt-4 flex items-center gap-4">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt="Cover preview"
              className="h-20 w-32 rounded-lg object-cover"
            />
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
              onChange={onPickCover}
              className="block text-[13px] text-[color:var(--color-text-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-bone hover:file:bg-forest-deep"
            />
            {coverUrl ? (
              <button
                type="button"
                onClick={clearCover}
                className="inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-[color:var(--color-state-error)]"
              >
                <X size={13} aria-hidden="true" /> Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-6 py-2.5 text-[14px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep disabled:opacity-70"
        >
          {saving ? "Saving" : isPublished ? "Save and keep published" : "Publish"}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full border border-forest/30 px-5 py-2.5 text-[14px] font-semibold text-forest transition-colors hover:bg-forest/5 disabled:opacity-70"
        >
          {isPublished ? "Move to draft" : "Save draft"}
        </button>
        <Link href="/library" className="ww-link text-[13.5px] font-semibold text-forest">
          Cancel
        </Link>
      </div>
    </div>
  );
}
