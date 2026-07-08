import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Flag, Link2, Users } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getOwnerPosts, getPublishingCadence } from "@/lib/data/library";
import { categoryLabel } from "@/lib/library/categories";
import { coachConfigured } from "@/lib/ai/config";
import { EmptyState } from "@/components/ui/EmptyState";
import { WeekCadenceCard } from "@/components/library/WeekCadenceCard";
import { PostRowActions } from "@/components/library/PostRowActions";

// The owner's Trailhead Library: compose, manage, and see the weekly rhythm.
// Owner only; a coach who lands here is sent back to Program. The public and
// member reader feed is a separate surface (Commit 3).
export default async function LibraryPage() {
  const session = await getSessionProfile();
  if (!session?.profile) redirect("/login");
  if (session.profile.role !== "owner") redirect("/program");

  const [posts, cadence] = await Promise.all([getOwnerPosts(), getPublishingCadence()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Link
          href="/trailhead"
          className="ww-link inline-flex items-center gap-1.5 text-[13px] font-semibold text-forest max-md:min-h-[44px]"
        >
          <Eye size={14} aria-hidden="true" />
          View the reader
        </Link>
      </div>
      <WeekCadenceCard cadence={cadence} />

      {posts.length === 0 ? (
        <EmptyState title="Your library starts with one note">
          Paste a link or write a couple of sentences, pick a category, and publish. It
          shows up here, in the app, and on the site. Use New post above to begin.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
          <ul>
            {posts.map((post, i) => (
              <li
                key={post.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${
                  i > 0 ? "border-t border-[color:var(--border-hair)]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={post.status} />
                    {post.is_challenge ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber/12 px-2 py-0.5 text-[11px] font-semibold text-amber-deep">
                        <Flag size={11} aria-hidden="true" />
                        Challenge{post.challenge_week ? ` · wk ${post.challenge_week}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 truncate font-[family-name:var(--font-display)] text-[16.5px] text-forest-deep">
                    {post.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--color-text-muted)]">
                    <span>{categoryLabel(post.category)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} aria-hidden="true" />
                      {post.audience === "public" ? "Public" : "Members"}
                    </span>
                    {post.external_link ? (
                      <span className="inline-flex items-center gap-1">
                        <Link2 size={11} aria-hidden="true" />
                        Link
                      </span>
                    ) : null}
                  </div>
                </div>
                <PostRowActions postId={post.id} status={post.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!coachConfigured() ? (
        <p className="px-1 text-[12.5px] text-[color:var(--color-text-faint)]">
          Scout can draft a blurb in the composer once its key is set in the deployment.
          Everything else works now.
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "published" }) {
  const style =
    status === "published"
      ? "bg-[color:var(--color-state-good)]/12 text-[color:var(--color-state-good)]"
      : "bg-[color:var(--color-state-caution)]/15 text-[color:var(--color-state-caution)]";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${style}`}>
      {status}
    </span>
  );
}
