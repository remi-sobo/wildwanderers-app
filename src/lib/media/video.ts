// Read a pasted or uploaded media URL and decide how to show it. Pure, so both
// the server and client can use it. YouTube and Vimeo become inline players via
// their embed hosts; a direct video file plays in a <video>; anything else is
// left as a safe link-out.

export type VideoSource =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "file"; src: string }
  | { kind: "link"; href: string }
  | { kind: "none" };

const YOUTUBE_ID = /^[\w-]{11}$/;

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v") ?? "";
      return YOUTUBE_ID.test(id) ? id : null;
    }
    const m = u.pathname.match(/^\/(embed|shorts|v)\/([\w-]{11})/);
    if (m && YOUTUBE_ID.test(m[2])) return m[2];
  }
  return null;
}

function vimeoId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = u.pathname.match(/\/(?:video\/)?(\d{6,})/);
  return m ? m[1] : null;
}

export function resolveVideo(url: string | null | undefined): VideoSource {
  const raw = (url ?? "").trim();
  if (!raw) return { kind: "none" };

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { kind: "none" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { kind: "none" };

  const yt = youtubeId(u);
  if (yt) return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${yt}` };

  const vm = vimeoId(u);
  if (vm) return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${vm}` };

  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(u.pathname + u.search)) {
    return { kind: "file", src: raw };
  }

  return { kind: "link", href: raw };
}
