// A persistent brand backdrop for the app workspace: layered ridgelines, a
// grove of evergreens, and topographic contours in the brand greens, spanning
// the bottom edge and fading out toward the left. It sits behind the paper
// cards and stays low-opacity so data always reads. Decorative only.
export function TrailTexture({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 340"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMaxYMax meet"
    >
      <defs>
        {/* Fade the whole scene out toward the left so it never crowds the
            rail or the left of the workspace. */}
        <linearGradient id="ww-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="black" />
          <stop offset="0.42" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
        <mask id="ww-mask">
          <rect width="1200" height="340" fill="url(#ww-fade)" />
        </mask>

        {/* One evergreen, reused at different sizes and tones. */}
        <g id="ww-pine">
          <path d="M0 0 L13 30 L-13 30 Z" />
          <path d="M0 14 L17 50 L-17 50 Z" />
          <path d="M0 30 L21 74 L-21 74 Z" />
          <rect x="-3" y="72" width="6" height="16" fill="#6b4a2e" />
        </g>
      </defs>

      <g mask="url(#ww-mask)">
        {/* Topographic contours sweeping across the upper area. */}
        <g stroke="#2e4a33" strokeWidth="1.5" fill="none" opacity="0.13">
          <path d="M120 96 C 320 72, 520 104, 760 84 S 1050 66, 1200 96" />
          <path d="M0 132 C 240 102, 460 142, 700 118 S 1010 98, 1200 130" />
          <path d="M0 168 C 250 138, 470 178, 720 154 S 1030 132, 1200 164" />
        </g>

        {/* Layered ridgelines along the bottom. */}
        <path
          d="M0 250 C 200 222, 380 250, 560 226 S 900 202, 1200 232 L1200 340 L0 340 Z"
          fill="#5f9a4f"
          opacity="0.14"
        />
        <path
          d="M0 280 C 220 256, 420 286, 640 263 S 980 241, 1200 270 L1200 340 L0 340 Z"
          fill="#2e4a33"
          opacity="0.18"
        />
        <path
          d="M0 306 C 240 289, 460 313, 700 297 S 1010 286, 1200 307 L1200 340 L0 340 Z"
          fill="#1e331f"
          opacity="0.24"
        />

        {/* The grove: a cluster on the right, a small pair mid-scene. */}
        <g opacity="0.22">
          <use href="#ww-pine" transform="translate(835,226) scale(0.8)" fill="#1e331f" />
          <use href="#ww-pine" transform="translate(880,210) scale(1.15)" fill="#2e4a33" />
          <use href="#ww-pine" transform="translate(935,196) scale(1.35)" fill="#1e331f" />
          <use href="#ww-pine" transform="translate(992,214) scale(1.05)" fill="#5f9a4f" />
          <use href="#ww-pine" transform="translate(1040,224) scale(0.85)" fill="#2e4a33" />
          <use href="#ww-pine" transform="translate(1086,230) scale(0.7)" fill="#5f9a4f" />
          <use href="#ww-pine" transform="translate(580,250) scale(0.7)" fill="#2e4a33" />
          <use href="#ww-pine" transform="translate(632,256) scale(0.55)" fill="#5f9a4f" />
        </g>
      </g>
    </svg>
  );
}
