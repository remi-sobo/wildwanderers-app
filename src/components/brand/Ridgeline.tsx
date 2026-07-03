// A calm layered ridgeline, the one bit of scenery that can crown a header.
// Three overlapping ridges in forest tones fading back into the distance.
export function Ridgeline({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 120"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      <path
        d="M0 96 L60 66 L120 84 L190 54 L250 78 L320 50 L400 74 L400 120 L0 120 Z"
        fill="#5f9a4f"
        fillOpacity="0.28"
      />
      <path
        d="M0 108 L70 82 L140 100 L210 72 L280 96 L350 70 L400 90 L400 120 L0 120 Z"
        fill="#2e4a33"
        fillOpacity="0.5"
      />
      <path
        d="M0 120 L80 100 L150 116 L230 92 L300 112 L370 94 L400 104 L400 120 L0 120 Z"
        fill="#1e331f"
        fillOpacity="0.85"
      />
    </svg>
  );
}
