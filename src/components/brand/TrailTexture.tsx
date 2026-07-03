// A persistent, low-opacity corner texture for the app workspace: a small grove
// of evergreens over a few topographic contour lines, in the brand greens. It
// lives bottom-right, behind the paper cards, so it reads as scenery without
// ever sitting behind dense data. Decorative only.
export function TrailTexture({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 520 380"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMaxYMax meet"
    >
      {/* Topographic contours sweeping in from the corner. */}
      <g stroke="#2e4a33" strokeWidth="1.5" opacity="0.14" fill="none">
        <path d="M520 150 C 430 150, 380 210, 300 220 S 150 250, 60 330" />
        <path d="M520 195 C 440 195, 390 250, 315 262 S 175 292, 95 366" />
        <path d="M520 242 C 452 242, 405 292, 335 304 S 205 335, 140 380" />
      </g>

      {/* The grove. Layered evergreens, tallest at the back. */}
      <g opacity="0.16">
        {/* Back tree */}
        <g fill="#2e4a33">
          <path d="M300 300 L332 300 L316 258 Z" />
          <path d="M303 268 L329 268 L316 232 Z" />
          <path d="M306 240 L326 240 L316 210 Z" />
          <rect x="313" y="300" width="6" height="16" fill="#6b4a2e" />
        </g>
        {/* Middle-left tree */}
        <g fill="#3c5b41">
          <path d="M356 312 L398 312 L377 256 Z" />
          <path d="M360 272 L394 272 L377 228 Z" />
          <path d="M364 238 L390 238 L377 200 Z" />
          <rect x="373" y="312" width="8" height="20" fill="#6b4a2e" />
        </g>
        {/* Front tree, fern-lit */}
        <g fill="#5f9a4f">
          <path d="M418 326 L470 326 L444 256 Z" />
          <path d="M423 280 L465 280 L444 222 Z" />
          <path d="M428 244 L460 244 L444 200 Z" />
          <rect x="440" y="326" width="8" height="24" fill="#6b4a2e" />
        </g>
        {/* Small sapling */}
        <g fill="#3c5b41">
          <path d="M486 330 L512 330 L499 296 Z" />
          <path d="M489 306 L509 306 L499 282 Z" />
          <rect x="496" y="330" width="6" height="14" fill="#6b4a2e" />
        </g>
      </g>

      {/* A soft ground line grounding the grove. */}
      <path
        d="M270 332 C 340 320, 420 348, 520 336 L520 380 L270 380 Z"
        fill="#2e4a33"
        opacity="0.06"
      />
    </svg>
  );
}
