// Pure, server-agnostic pillar constants and band types. No server imports, so
// both client components and server readers can use these safely.

export type PillarKey =
  | "move_well"
  | "be_strong"
  | "carry"
  | "go_far"
  | "move_fast"
  | "recover_well"
  | "healthy_habits";

export type Band = "healthy" | "improving" | "needs_attention";

export const PILLAR_ORDER: PillarKey[] = [
  "move_well",
  "be_strong",
  "carry",
  "go_far",
  "move_fast",
  "recover_well",
  "healthy_habits",
];

export const PILLAR_LABEL: Record<PillarKey, string> = {
  move_well: "Move well",
  be_strong: "Be strong",
  carry: "Carry things",
  go_far: "Go far",
  move_fast: "Move fast",
  recover_well: "Recover well",
  healthy_habits: "Healthy habits",
};
