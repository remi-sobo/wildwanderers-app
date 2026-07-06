"use client";

import { useMemo, useState, useTransition } from "react";
import { Flag, Check, ArrowUpRight, Users } from "lucide-react";
import { POST_CATEGORIES } from "@/lib/library/categories";
import { setChallengeDone } from "@/lib/library/challenge-actions";
import { PostCard } from "@/components/library/PostCard";
import type { Post } from "@/lib/data/library";

// The reader feed: a featured weekly challenge, a category filter, and a grid
// that reads like a field journal. Counts are real, straight off the post row.
export function TrailheadFeed({
  posts,
  challenge,
  challengeDone,
  canComplete,
}: {
  posts: Post[];
  challenge: Post | null;
  challengeDone: boolean;
  canComplete: boolean;
}) {
  const [active, setActive] = useState<string>("all");

  // Only show category tabs that actually have posts, so the filter never lies.
  const present = useMemo(() => {
    const set = new Set(posts.map((p) => p.category));
    if (challenge) set.add(challenge.category);
    return POST_CATEGORIES.filter((c) => set.has(c.value));
  }, [posts, challenge]);

  const gridPosts = useMemo(
    () => (active === "all" ? posts : posts.filter((p) => p.category === active)),
    [posts, active],
  );

  return (
    <div className="flex flex-col gap-6">
      {challenge ? (
        <ChallengeFeature challenge={challenge} done={challengeDone} canComplete={canComplete} />
      ) : null}

      {present.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <FilterTab label="All" value="all" active={active} onSelect={setActive} />
          {present.map((c) => (
            <FilterTab
              key={c.value}
              label={c.label}
              value={c.value}
              active={active}
              onSelect={setActive}
            />
          ))}
        </div>
      ) : null}

      {gridPosts.length === 0 ? (
        <p className="rounded-2xl border border-[color:var(--border-hair)] bg-card px-6 py-10 text-center text-[14px] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
          Nothing in this section yet. More trail notes are on the way.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gridPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  value,
  active,
  onSelect,
}: {
  label: string;
  value: string;
  active: string;
  onSelect: (v: string) => void;
}) {
  const on = active === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={on}
      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        on
          ? "bg-forest text-bone"
          : "border border-[color:var(--border-hair)] text-[color:var(--color-text-muted)] hover:bg-inset"
      }`}
    >
      {label}
    </button>
  );
}

function ChallengeFeature({
  challenge,
  done,
  canComplete,
}: {
  challenge: Post;
  done: boolean;
  canComplete: boolean;
}) {
  // Optimistic: the tally and the button flip at once, and reconcile if the
  // write fails. Real numbers only, starting from the stored count.
  const [isDone, setIsDone] = useState(done);
  const [count, setCount] = useState(challenge.completion_count);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !isDone;
    setIsDone(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    start(async () => {
      const res = await setChallengeDone(challenge.id, next);
      if (!res.ok) {
        // Roll back on failure.
        setIsDone(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    });
  }

  const isLink = Boolean(challenge.external_link);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber/30 bg-card shadow-[var(--shadow-card)]">
      <div className="grid md:grid-cols-[1.4fr_1fr]">
        <div className="p-6 md:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-deep">
            <Flag size={12} aria-hidden="true" />
            This week&apos;s challenge{challenge.challenge_week ? ` · week ${challenge.challenge_week}` : ""}
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[24px] leading-tight text-forest-deep md:text-[27px]">
            {challenge.title}
          </h2>
          {challenge.body ? (
            <p className="mt-2 max-w-prose text-[14.5px] leading-[1.6] text-[color:var(--color-text)]">
              {challenge.body}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            {isLink ? (
              <a
                href={challenge.external_link!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-forest/30 px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-forest/5"
              >
                Open it
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            ) : null}

            {canComplete ? (
              <button
                type="button"
                onClick={toggle}
                disabled={pending}
                className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors disabled:opacity-70 ${
                  isDone
                    ? "bg-fern/15 text-[color:var(--color-state-good)]"
                    : "bg-amber text-[#23170c] hover:bg-amber-deep"
                }`}
              >
                {isDone ? (
                  <>
                    <Check size={15} aria-hidden="true" />
                    Done
                  </>
                ) : (
                  "Mark done"
                )}
              </button>
            ) : null}

            <span className="inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-text-muted)]">
              <Users size={14} aria-hidden="true" />
              {count === 0
                ? "Be the first to finish it"
                : `${count} ${count === 1 ? "person has" : "people have"} finished it`}
            </span>
          </div>
        </div>

        {challenge.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={challenge.cover_image_url}
            alt=""
            className="h-full min-h-[180px] w-full object-cover"
          />
        ) : (
          <div className="hidden bg-inset md:block" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
