"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, MessageSquare, Trash2 } from "lucide-react";
import {
  addPlanComment,
  deletePlanComment,
  respondSwap,
  withdrawSwap,
} from "@/lib/plans/talk-actions";
import type { PlanComment, PlanSwap } from "@/lib/data/plan-talk";

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The conversation on one plan: comments both ways, and the coach's swap
// suggestions with the client's answer. Visibility is the plan's own RLS;
// this component only renders what the server already allowed.
export function PlanTalk({
  planId,
  comments,
  swaps,
  viewerId,
  viewerIsStaff,
  otherLabel,
  exerciseTitles,
  revalidate,
}: {
  planId: string;
  comments: PlanComment[];
  swaps: PlanSwap[];
  viewerId: string;
  viewerIsStaff: boolean;
  otherLabel: string;
  exerciseTitles: Record<string, string>;
  revalidate: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pendingSwaps = swaps.filter((s) => s.status === "pending");
  const answeredSwaps = swaps.filter((s) => s.status !== "pending").slice(0, 3);

  function submitComment() {
    setError(null);
    const content = draft;
    startTransition(async () => {
      const result = await addPlanComment(planId, content, { revalidate });
      if (result.error) setError(result.error);
      else setDraft("");
    });
  }

  function answer(swapId: string, accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondSwap(swapId, accept);
      if (result.error) setError(result.error);
    });
  }

  function withdraw(swapId: string) {
    startTransition(async () => {
      await withdrawSwap(swapId, revalidate);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border-hair)] bg-inset/40 p-4">
      {/* Swap suggestions */}
      {pendingSwaps.map((s) => (
        <div
          key={s.id}
          className="flex flex-col gap-2 rounded-xl border border-amber/40 bg-amber/8 px-4 py-3"
        >
          <p className="flex items-start gap-2 text-[13.5px] text-[color:var(--color-text)]">
            <ArrowLeftRight size={14} className="mt-0.5 shrink-0 text-amber-deep" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{s.suggested_title}</strong>
              {" in place of "}
              <strong className="font-semibold">
                {exerciseTitles[s.workout_exercise_id] ?? "that movement"}
              </strong>
              {[
                s.suggested_sets ? `${s.suggested_sets} sets` : "",
                s.suggested_reps ?? "",
                s.suggested_load ?? "",
              ]
                .filter(Boolean)
                .join(" · ")
                .replace(/^(.)/, " · $1")}
              {s.reason ? (
                <span className="block text-[12.5px] text-[color:var(--color-text-muted)]">
                  {s.reason}
                </span>
              ) : null}
            </span>
          </p>
          <div className="flex items-center gap-2 pl-6">
            {viewerIsStaff ? (
              <>
                <span className="text-[12px] text-[color:var(--color-text-muted)]">
                  Waiting on their answer
                </span>
                <button
                  type="button"
                  onClick={() => withdraw(s.id)}
                  disabled={pending}
                  className="inline-flex items-center px-2 text-[12px] font-semibold text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)] max-md:min-h-[44px]"
                >
                  Withdraw
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => answer(s.id, true)}
                  disabled={pending}
                  className="inline-flex items-center justify-center rounded-full bg-forest px-3.5 py-1.5 text-[12.5px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
                >
                  Swap it in
                </button>
                <button
                  type="button"
                  onClick={() => answer(s.id, false)}
                  disabled={pending}
                  className="inline-flex items-center px-2 text-[12.5px] font-semibold text-[color:var(--color-text-muted)] transition-colors hover:text-ink max-md:min-h-[44px]"
                >
                  Not this time
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {answeredSwaps.map((s) => (
        <p key={s.id} className="pl-1 text-[12px] text-[color:var(--color-text-faint)]">
          {s.suggested_title}: {s.status === "accepted" ? "swapped in" : "kept as it was"}
        </p>
      ))}

      {/* Comments */}
      {comments.map((c) => {
        const mine = c.author_id === viewerId;
        return (
          <div key={c.id} className="flex items-start gap-2.5">
            <MessageSquare
              size={14}
              className={`mt-1 shrink-0 ${mine ? "text-bark" : "text-forest"}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-bark">
                {mine ? "You" : otherLabel}
                <span className="ml-2 font-normal text-[color:var(--color-text-faint)]">
                  {when(c.created_at)}
                  {c.workout_exercise_id && exerciseTitles[c.workout_exercise_id]
                    ? ` · on ${exerciseTitles[c.workout_exercise_id]}`
                    : ""}
                </span>
              </p>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.5] text-[color:var(--color-text)]">
                {c.content}
              </p>
            </div>
            {mine ? (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await deletePlanComment(c.id, revalidate);
                  })
                }
                aria-label="Delete your comment"
                className="mt-0.5 text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
              >
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        );
      })}

      {error ? (
        <p role="alert" className="text-[12.5px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) submitComment();
          }}
          placeholder={viewerIsStaff ? "Leave a note on this plan" : "Ask or answer here"}
          className="h-11 min-w-0 flex-1 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-3 text-[16px] text-ink md:h-10 md:text-[13.5px]"
        />
        <button
          type="button"
          onClick={submitComment}
          disabled={pending || !draft.trim()}
          className="inline-flex items-center justify-center rounded-full bg-forest px-4 py-2 text-[12.5px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
        >
          {pending ? "Sending" : "Send"}
        </button>
      </div>
    </div>
  );
}
