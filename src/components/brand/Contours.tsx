// Faint topographic contour lines. Used only as a low-opacity watermark in the
// dark rail, never behind data. Inherits color from `currentColor`.
export function Contours({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <path d="M-20 120 C 40 90, 90 150, 150 120 S 250 80, 300 130" />
      <path d="M-20 150 C 40 120, 95 180, 155 150 S 255 110, 300 160" />
      <path d="M-20 182 C 45 152, 100 212, 160 182 S 258 142, 300 192" />
      <path d="M-20 216 C 50 186, 105 246, 165 216 S 262 176, 300 226" />
      <path d="M-20 252 C 55 222, 110 282, 170 252 S 266 212, 300 262" />
      <path d="M-20 292 C 60 262, 115 322, 175 292 S 270 252, 300 302" />
      <path d="M-20 336 C 65 306, 120 366, 180 336 S 274 296, 300 346" />
    </svg>
  );
}
