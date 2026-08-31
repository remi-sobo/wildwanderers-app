// Block types, colors, and time helpers for the Schedule surface,
// shared by server readers and client components. Keep this module free
// of server imports; it ships in the client bundle.

export type BlockType = "client" | "group" | "ww" | "admin" | "personal" | "travel";
export type BlockRecur = "weekly" | "biweekly" | "monthly" | "once";

export const BLOCK_TYPES: { key: BlockType; label: string; color: string }[] = [
  { key: "client", label: "Client 1:1", color: "#2e4a33" },
  { key: "group", label: "Small group", color: "#5f9a4f" },
  { key: "ww", label: "Wild Wanderers", color: "#d98a3a" },
  { key: "admin", label: "Work block", color: "#6b4a2e" },
  { key: "personal", label: "Personal", color: "#4e7c74" },
  { key: "travel", label: "Travel", color: "#9c9482" },
];

// The earthy palette Settings may recolor a type from.
export const BLOCK_PALETTE = [
  "#2e4a33", "#5f9a4f", "#d98a3a", "#6b4a2e", "#4e7c74", "#c0942e", "#7c9a6e", "#9c9482",
];

export const RECURS: { key: BlockRecur; label: string; suffix: string }[] = [
  { key: "weekly", label: "Every week", suffix: "" },
  { key: "biweekly", label: "Every other week", suffix: "· every other week" },
  { key: "monthly", label: "Monthly", suffix: "· monthly" },
  { key: "once", label: "One time", suffix: "· one time" },
];

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function typeColor(type: BlockType, overrides: Record<string, string>): string {
  return overrides[type] ?? BLOCK_TYPES.find((t) => t.key === type)?.color ?? "#6b4a2e";
}

// "6:30" and "6:30 AM" pieces; ranges render "6:30 – 7:30 AM" with the
// meridiem only where it changes or at the end.
export function formatMinutes(min: number, withMeridiem: boolean): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const mer = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const base = m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, "0")}`;
  return withMeridiem ? `${base} ${mer}` : base;
}

export function formatRange(startMin: number, endMin: number): string {
  const sameMeridiem = (startMin < 720) === (endMin < 720 || endMin === 1440);
  return `${formatMinutes(startMin, !sameMeridiem)} – ${formatMinutes(endMin, true)}`;
}

// The Monday of the local week, as yyyy-mm-dd. The org's week starts
// Monday; task links are keyed by this.
export function weekStartKey(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
