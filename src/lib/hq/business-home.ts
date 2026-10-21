// Pure pieces of the owner HQ Business launchpad: the module directory,
// the Quick access tile list, and local-day helpers. No server imports;
// it ships in the client bundle and is unit tested.

import {
  Activity,
  Backpack,
  BookOpen,
  CalendarDays,
  ChartColumn,
  Footprints,
  GitBranch,
  ListChecks,
  MessageCircle,
  Settings,
  Tent,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey =
  | "tasks"
  | "schedule"
  | "messages"
  | "clients"
  | "boys"
  | "fitness"
  | "popup"
  | "leads"
  | "numbers"
  | "library"
  | "alongside"
  | "settings";

export type HqModule = { key: ModuleKey; label: string; href: string; hint: string; icon: LucideIcon };

// Every destination links to a route that already exists. Labels and
// hints follow the approved design.
export const MODULES: Record<ModuleKey, HqModule> = {
  tasks: { key: "tasks", label: "Tasks", href: "/tasks", hint: "Everything, by program", icon: ListChecks },
  schedule: { key: "schedule", label: "Schedule", href: "/schedule", hint: "Your week, fixed and flexible", icon: CalendarDays },
  messages: { key: "messages", label: "Messages", href: "/messages", hint: "Clients and families", icon: MessageCircle },
  clients: { key: "clients", label: "Clients", href: "/program", hint: "Profiles, plans, check-ins", icon: Users },
  boys: { key: "boys", label: "Dads & Kids", href: "/boys", hint: "The boys program", icon: Backpack },
  fitness: { key: "fitness", label: "Fitness", href: "/fitness", hint: "Wellness, assessments, movements", icon: Activity },
  popup: { key: "popup", label: "Pop-up days", href: "/business/popup", hint: "Roll call, walk-ups, waivers", icon: Tent },
  leads: { key: "leads", label: "Leads", href: "/business/pipeline", hint: "Follow-ups and pipeline", icon: GitBranch },
  numbers: { key: "numbers", label: "Numbers", href: "/business/numbers", hint: "Revenue, clients, targets", icon: ChartColumn },
  library: { key: "library", label: "Trailhead Library", href: "/library", hint: "Posts and the weekly challenge", icon: BookOpen },
  alongside: { key: "alongside", label: "Alongside", href: "/alongside", hint: "Share your own week", icon: Footprints },
  settings: { key: "settings", label: "Settings", href: "/settings", hint: "Organization, team, layout", icon: Settings },
};

export const DIRECTORY: { label: string; keys: ModuleKey[] }[] = [
  { label: "Day to day", keys: ["tasks", "schedule", "messages"] },
  { label: "Clients and programs", keys: ["clients", "boys", "fitness", "popup"] },
  { label: "Growing the business", keys: ["leads", "numbers"] },
  { label: "Sharing and setup", keys: ["library", "alongside", "settings"] },
];

export const QUICK_MAX = 4;
export const QUICK_DEFAULT: ModuleKey[] = ["clients", "boys", "popup", "leads"];
export const QUICK_STORAGE_KEY = "ww.hq.quickAccess";

const isModuleKey = (k: unknown): k is ModuleKey => typeof k === "string" && k in MODULES;

/** Reads a saved tile list, falling back to the defaults on anything odd. */
export function parseQuickAccess(raw: string | null): ModuleKey[] {
  if (!raw) return QUICK_DEFAULT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return QUICK_DEFAULT;
    const keys = [...new Set(parsed.filter(isModuleKey))].slice(0, QUICK_MAX);
    return keys.length > 0 ? keys : QUICK_DEFAULT;
  } catch {
    return QUICK_DEFAULT;
  }
}

/** Adds a tile at the end; with the row full, the last tile makes way. */
export function addTile(list: ModuleKey[], key: ModuleKey): ModuleKey[] {
  if (list.includes(key)) return list;
  const room = list.length >= QUICK_MAX ? list.slice(0, QUICK_MAX - 1) : list;
  return [...room, key];
}

export function removeTile(list: ModuleKey[], key: ModuleKey): ModuleKey[] {
  return list.filter((k) => k !== key);
}

export function moveTileEarlier(list: ModuleKey[], key: ModuleKey): ModuleKey[] {
  const i = list.indexOf(key);
  if (i <= 0) return list;
  const next = [...list];
  [next[i - 1], next[i]] = [next[i], next[i - 1]];
  return next;
}

/** The viewer's local calendar day, yyyy-mm-dd, matching a date column. */
export function localDayKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** How many of these due dates fall on or before today. */
export function countDueBy(dues: string[], todayKey: string): number {
  return dues.filter((d) => d.slice(0, 10) <= todayKey).length;
}

/** "Sat Oct 24 at 8:00" in the viewer's own timezone. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const m = d.getMinutes();
  return `${day.replace(",", "")} at ${m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`}`;
}
