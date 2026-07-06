"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { deletePost, setPostPublished } from "@/lib/library/actions";

// The per-post controls in the owner list: edit, publish/unpublish, delete.
// Delete asks once inline before it fires; the owner can wipe a post in a tap,
// which is the delete-anytime the brief asks for.
export function PostRowActions({
  postId,
  status,
}: {
  postId: string;
  status: "draft" | "published";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePublish() {
    setError(null);
    start(async () => {
      const res = await setPostPublished(postId, status !== "published");
      if (!res.ok) setError(res.error ?? "That did not save.");
      else router.refresh();
    });
  }

  function confirmDelete() {
    setError(null);
    start(async () => {
      const res = await deletePost(postId);
      if (!res.ok) {
        setError(res.error ?? "Could not delete that.");
        setConfirming(false);
      } else {
        router.refresh();
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-[color:var(--color-text-muted)]">Delete this post?</span>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={pending}
          className="rounded-full bg-[color:var(--color-state-error)] px-3 py-1.5 text-[12.5px] font-semibold text-bone disabled:opacity-70"
        >
          {pending ? "Deleting" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-full px-2 py-1.5 text-[12.5px] font-semibold text-forest"
        >
          Keep
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {error ? (
        <span className="mr-1 text-[12px] text-[color:var(--color-state-error)]">{error}</span>
      ) : null}
      <button
        type="button"
        onClick={togglePublish}
        disabled={pending}
        title={status === "published" ? "Move to draft" : "Publish"}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--color-text-muted)] transition-colors hover:bg-inset hover:text-forest disabled:opacity-60"
      >
        {status === "published" ? (
          <EyeOff size={15} aria-hidden="true" />
        ) : (
          <Eye size={15} aria-hidden="true" />
        )}
      </button>
      <Link
        href={`/library/${postId}/edit`}
        title="Edit"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--color-text-muted)] transition-colors hover:bg-inset hover:text-forest"
      >
        <Pencil size={15} aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Delete"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-state-error)]/10 hover:text-[color:var(--color-state-error)]"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
