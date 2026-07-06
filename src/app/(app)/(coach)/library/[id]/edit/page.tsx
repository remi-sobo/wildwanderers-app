import { redirect, notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getPostById } from "@/lib/data/library";
import { coachConfigured } from "@/lib/ai/config";
import { PostComposer, type ComposerInitial } from "@/components/library/PostComposer";

// Edit a post. Owner only. Same composer as New, pre-filled from the row.
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionProfile();
  if (!session?.profile) redirect("/login");
  if (session.profile.role !== "owner") redirect("/program");

  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  const initial: ComposerInitial = {
    id: post.id,
    title: post.title,
    category: post.category,
    audience: post.audience,
    externalLink: post.external_link ?? "",
    body: post.body ?? "",
    coverUrl: post.cover_image_url,
    status: post.status,
    isChallenge: post.is_challenge,
    challengeWeek: post.challenge_week,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-[24px] leading-tight text-forest-deep">
          Edit post
        </h2>
        <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
          Change anything and save. Moving a published post to draft pulls it from the app
          and the site.
        </p>
      </div>
      <PostComposer mode="edit" initial={initial} coachConfigured={coachConfigured()} />
    </div>
  );
}
