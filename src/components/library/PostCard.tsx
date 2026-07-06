import { ArrowUpRight, Users } from "lucide-react";
import { categoryLabel } from "@/lib/library/categories";
import type { Post } from "@/lib/data/library";

// One entry in the field journal. A link post opens out; a body-only post reads
// in place. Calm and editorial, the site's card rhythm carried into the app.
export function PostCard({ post }: { post: Post }) {
  const isLink = Boolean(post.external_link);
  const Wrapper = isLink ? "a" : "div";
  const linkProps = isLink
    ? { href: post.external_link!, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Wrapper
      {...linkProps}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)] transition-all ${
        isLink ? "hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]" : ""
      }`}
    >
      {post.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_image_url}
          alt=""
          className="h-40 w-full object-cover"
          loading="lazy"
        />
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
            {categoryLabel(post.category)}
          </span>
          {post.audience === "members" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-inset px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--color-text-muted)]">
              <Users size={10} aria-hidden="true" />
              Members
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 font-[family-name:var(--font-display)] text-[19px] leading-snug text-forest-deep">
          {post.title}
          {isLink ? (
            <ArrowUpRight
              size={16}
              aria-hidden="true"
              className="ml-1 inline-block text-[color:var(--color-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          ) : null}
        </h3>
        {post.body ? (
          <p className="mt-2 line-clamp-4 text-[14px] leading-[1.55] text-[color:var(--color-text)]">
            {post.body}
          </p>
        ) : null}
      </div>
    </Wrapper>
  );
}
