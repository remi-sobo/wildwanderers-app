import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { Band, LongevityTest } from "@/lib/data/wellness";

export const BAND_LABEL: Record<Band, string> = {
  healthy: "Healthy",
  improving: "Improving",
  needs_attention: "Needs attention",
};

// Warm, never alarming. "Needs attention" is an invitation, not a red flag.
export const BAND_DOT: Record<Band, string> = {
  healthy: "var(--color-state-good)",
  improving: "var(--color-state-caution)",
  needs_attention: "var(--color-bark)",
};

export function BandChip({ band }: { band: Band | null }) {
  if (!band) {
    return <span className="text-[12px] text-[color:var(--color-text-muted)]">Not tested yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-forest-deep">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAND_DOT[band] }} aria-hidden="true" />
      {BAND_LABEL[band]}
    </span>
  );
}

export function Trend({ test }: { test: LongevityTest }) {
  if (test.latestValue === null || test.previousValue === null) return null;
  const delta = test.latestValue - test.previousValue;
  if (delta === 0) {
    return <Minus size={13} strokeWidth={2} className="text-[color:var(--color-text-muted)]" aria-label="holding" />;
  }
  const better = test.higherIsBetter ? delta > 0 : delta < 0;
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <Icon
      size={13}
      strokeWidth={2}
      className={better ? "text-forest" : "text-[color:var(--color-text-muted)]"}
      aria-label={better ? "moving the right way" : "moving the other way"}
    />
  );
}

export function fmtValue(test: LongevityTest): string | null {
  if (test.latestValueText) return test.latestValueText;
  if (test.latestValue === null) return null;
  return `${test.latestValue} ${test.unit}`;
}
