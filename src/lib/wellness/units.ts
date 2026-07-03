// Body data is stored canonically in metric (kg, cm); the UI works in the
// units Gabe and his clients think in (lb, in). One place for the maths so
// Log and Progress never drift.

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}
export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}
export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}
export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

// Round for display without trailing noise.
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
