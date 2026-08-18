"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Check } from "lucide-react";
import { saveIntake } from "@/lib/intake/actions";
import { FlagComposer } from "@/components/coach/FlagsBand";
import type { IntakeRow } from "@/lib/data/intake";

// The guided intake, built for speed mid-conversation: Gabe types while
// talking, each section saves on its own, and a line worth remembering is
// promoted to a standing flag without leaving the story. A living record,
// editable after the fact, versioned by its updated_at.

function SectionSave({
  pending,
  dirty,
  saved,
  onSave,
}: {
  pending: boolean;
  dirty: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onSave}
        disabled={pending || !dirty}
        className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-50 max-md:min-h-[44px]"
      >
        <Check size={14} aria-hidden="true" />
        {pending ? "Saving" : "Save"}
      </button>
      {saved && !dirty ? <span className="text-[12.5px] text-forest">Saved.</span> : null}
    </div>
  );
}

export function IntakeScreen({
  clientId,
  initialGoal,
  intake,
}: {
  clientId: string;
  initialGoal: string;
  intake: IntakeRow | null;
}) {
  const router = useRouter();

  const [goal, setGoal] = useState(initialGoal);
  const [story, setStory] = useState(intake?.story_md ?? "");
  const [lifestyle, setLifestyle] = useState(intake?.lifestyle_md ?? "");

  const [savedGoal, setSavedGoal] = useState(initialGoal);
  const [savedStory, setSavedStory] = useState(intake?.story_md ?? "");
  const [savedLifestyle, setSavedLifestyle] = useState(intake?.lifestyle_md ?? "");

  const [err, setErr] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<"goal" | "story" | "lifestyle" | null>(null);
  const [pendingSection, setPendingSection] = useState<"goal" | "story" | "lifestyle" | null>(null);
  const [, start] = useTransition();

  // Promote-to-flag: select a phrase in the story, promote it without
  // leaving the field.
  const storyRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState("");
  const [promoting, setPromoting] = useState(false);

  function captureSelection() {
    const el = storyRef.current;
    if (!el) return;
    const text = el.value.slice(el.selectionStart, el.selectionEnd).trim();
    setSelection(text.length >= 3 ? text.slice(0, 140) : "");
  }

  function save(section: "goal" | "story" | "lifestyle") {
    setErr(null);
    setPendingSection(section);
    start(async () => {
      const input =
        section === "goal" ? { goal } : section === "story" ? { story } : { lifestyle };
      const res = await saveIntake(clientId, input);
      setPendingSection(null);
      if (res.error) setErr(res.error);
      else {
        if (section === "goal") setSavedGoal(goal);
        if (section === "story") setSavedStory(story);
        if (section === "lifestyle") setSavedLifestyle(lifestyle);
        setJustSaved(section);
        router.refresh();
      }
    });
  }

  const touched = intake?.updated_at
    ? new Date(intake.updated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* The goal, in their words */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
          The goal, in their words
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          Verbatim. This is the headline of their profile.
        </p>
        <textarea
          className="ww-input mt-3 w-full resize-y"
          rows={2}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What they said, the way they said it."
        />
        <div className="mt-2.5">
          <SectionSave
            pending={pendingSection === "goal"}
            dirty={goal !== savedGoal}
            saved={justSaved === "goal"}
            onSave={() => save("goal")}
          />
        </div>
      </section>

      {/* The story */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
              The story
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
              Health and movement history as they tell it: old injuries, what
              they&apos;ve tried, what they mention. Written once, read when needed.
            </p>
          </div>
          {selection && !promoting ? (
            <button
              type="button"
              onClick={() => setPromoting(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber/60 bg-amber/10 px-3 py-1.5 text-[12.5px] font-semibold text-amber-deep transition hover:bg-amber/20 max-md:min-h-[44px]"
            >
              <Flag size={13} aria-hidden="true" />
              Promote to flag
            </button>
          ) : null}
        </div>
        <textarea
          ref={storyRef}
          className="ww-input mt-3 w-full resize-y"
          rows={8}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          onSelect={captureSelection}
          onBlur={() => setTimeout(() => setSelection((s) => (promoting ? s : "")), 200)}
          placeholder="Ran cross country in school, desk job since. Knee scoped in 2019..."
        />
        <p className="mt-1.5 text-[12px] text-[color:var(--color-text-faint)]">
          Select a phrase to promote it to a standing flag.
        </p>
        {promoting ? (
          <div className="mt-3">
            <FlagComposer
              clientId={clientId}
              initialKnow={selection}
              createdFrom="intake"
              onDone={() => {
                setPromoting(false);
                setSelection("");
              }}
            />
          </div>
        ) : null}
        <div className="mt-2.5">
          <SectionSave
            pending={pendingSection === "story"}
            dirty={story !== savedStory}
            saved={justSaved === "story"}
            onSave={() => save("story")}
          />
        </div>
      </section>

      {/* Lifestyle basics */}
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
          Lifestyle basics
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          Work shape, sleep, activity today, what the week allows.
        </p>
        <textarea
          className="ww-input mt-3 w-full resize-y"
          rows={4}
          value={lifestyle}
          onChange={(e) => setLifestyle(e.target.value)}
          placeholder="Desk work, sleeps about seven hours, mornings are free..."
        />
        <div className="mt-2.5">
          <SectionSave
            pending={pendingSection === "lifestyle"}
            dirty={lifestyle !== savedLifestyle}
            saved={justSaved === "lifestyle"}
            onSave={() => save("lifestyle")}
          />
        </div>
      </section>

      {err ? (
        <p role="alert" className="text-[13px] text-[color:var(--color-state-error)]">
          {err}
        </p>
      ) : null}

      {touched ? (
        <p className="text-[12px] text-[color:var(--color-text-faint)]">
          A living record, edited any time. Last touched {touched}.
        </p>
      ) : null}
    </div>
  );
}
