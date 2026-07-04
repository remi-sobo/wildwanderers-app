import type { CSSProperties } from "react";

// The Wild Wanderers defaults. When an org keeps these, we apply no overrides so
// the hand-tuned palette in globals.css stays pixel-identical. A second org with
// its own colors gets a derived palette so its app looks like theirs.
const DEFAULT_PRIMARY = "#2e4a33";
const DEFAULT_SECONDARY = "#d98a3a";

function clampHex(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : DEFAULT_PRIMARY;
}
function toRgb(hex: string): [number, number, number] {
  const h = clampHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hex: string, toward: [number, number, number], amt: number): string {
  const [r, g, b] = toRgb(hex);
  return toHex([r + (toward[0] - r) * amt, g + (toward[1] - g) * amt, b + (toward[2] - b) * amt]);
}
const darken = (hex: string, amt: number) => mix(hex, [0, 0, 0], amt);
const lighten = (hex: string, amt: number) => mix(hex, [255, 255, 255], amt);

// The CSS variable overrides for an org's brand, or an empty object when the org
// runs the default palette. Set on the app shell root so every descendant that
// reads var(--color-forest) etc. picks up the org's colors.
export function orgThemeStyle(primary: string | null, secondary: string | null): CSSProperties {
  const p = clampHex(primary ?? DEFAULT_PRIMARY);
  const s = clampHex(secondary ?? DEFAULT_SECONDARY);
  if (p === DEFAULT_PRIMARY && s === DEFAULT_SECONDARY) return {};

  return {
    "--color-forest": p,
    "--color-forest-deep": darken(p, 0.32),
    "--color-chrome": darken(p, 0.32),
    "--color-fern": lighten(p, 0.24),
    "--color-amber": s,
    "--color-amber-deep": darken(s, 0.18),
    "--color-cream": lighten(s, 0.35),
  } as CSSProperties;
}
