import { PlayCircle } from "lucide-react";
import { resolveVideo } from "@/lib/media/video";

// One place that turns a movement's media URL into the right player. A YouTube
// or Vimeo link is a responsive inline frame; a hosted clip is a native video;
// anything else stays a link so nothing ever silently breaks. Renders nothing
// when there is no usable URL.
export function VideoEmbed({
  url,
  title,
  className = "",
}: {
  url: string | null | undefined;
  title?: string;
  className?: string;
}) {
  const v = resolveVideo(url);
  if (v.kind === "none") return null;

  if (v.kind === "link") {
    return (
      <a
        href={v.href}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-1.5 text-[13px] font-semibold text-forest transition-colors hover:text-fern ${className}`}
      >
        <PlayCircle size={16} aria-hidden="true" />
        Watch demo
      </a>
    );
  }

  const frame =
    "aspect-video w-full overflow-hidden rounded-xl border border-[color:var(--border-hair)] bg-black";

  if (v.kind === "file") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video src={v.src} controls preload="metadata" className={`${frame} ${className}`} />
    );
  }

  return (
    <div className={`${frame} ${className}`}>
      <iframe
        src={v.embedUrl}
        title={title ?? "Movement demo"}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}

// A compact "watch" affordance for dense lists where a full frame is too much:
// a small play link that still uses the same resolver, so a real player is one
// tap away without crowding the row.
export function VideoBadge({ url }: { url: string | null | undefined }) {
  const v = resolveVideo(url);
  if (v.kind === "none") return null;
  const href = v.kind === "link" ? v.href : v.kind === "file" ? v.src : v.embedUrl;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-forest transition-colors hover:text-fern"
      aria-label="Watch demo"
    >
      <PlayCircle size={15} aria-hidden="true" />
      Video
    </a>
  );
}
