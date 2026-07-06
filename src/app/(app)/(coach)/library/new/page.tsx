import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { coachConfigured } from "@/lib/ai/config";
import { PostComposer } from "@/components/library/PostComposer";

// Compose a new post. Owner only. Under a minute: title, a link or a short
// body, a category, an audience, publish. Everything else is optional.
export default async function NewPostPage() {
  const session = await getSessionProfile();
  if (!session?.profile) redirect("/login");
  if (session.profile.role !== "owner") redirect("/program");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-[24px] leading-tight text-forest-deep">
          New post
        </h2>
        <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
          A trail note for the library. Defaults to public, so member only is always your
          choice.
        </p>
      </div>
      <PostComposer mode="create" coachConfigured={coachConfigured()} />
    </div>
  );
}
