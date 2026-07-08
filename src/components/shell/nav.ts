import {
  Activity,
  Backpack,
  BookOpen,
  Briefcase,
  Footprints,
  ClipboardList,
  Dumbbell,
  House,
  MessageCircle,
  NotebookPen,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/get-profile";

// One source of truth for where each role can go. The desktop sidebar reads
// the full sections; the mobile bottom bar splits the same items into up to
// four tabs plus a More sheet, so the two navs can never drift apart.

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  /** Short label for the bottom tab bar, where space is tight. */
  short?: string;
};
export type NavSection = { label?: string; items: NavItem[] };
export type MobileNavSplit = { tabs: NavItem[]; more: NavItem[] };

const MESSAGES: NavItem = { href: "/messages", label: "Messages", icon: MessageCircle };
const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings };

const WORKSPACE: NavSection = {
  label: "Workspace",
  items: [MESSAGES, SETTINGS],
};

const PROGRAM: NavItem = { href: "/program", label: "Program", icon: ClipboardList, hint: "Clients and training" };
const FITNESS: NavItem = { href: "/fitness", label: "Fitness", icon: Activity, hint: "Wellness and tracking" };
const BOYS: NavItem = { href: "/boys", label: "Dads & Kids", icon: Backpack, hint: "The boys program", short: "Dads & Kids" };
const BUSINESS: NavItem = { href: "/business", label: "Business", icon: Briefcase, hint: "The business switch" };
const COACH_ALONGSIDE: NavItem = { href: "/alongside", label: "Alongside", icon: Footprints, hint: "Share your own week" };
const LIBRARY_COMPOSER: NavItem = {
  href: "/library",
  label: "Trailhead Library",
  icon: BookOpen,
  hint: "Your living library",
  short: "Library",
};

// Business is Gabe's back office, owner-only. A coach sees Program and Fitness.
// Alongside (share your own week) is owner and coach. The Trailhead Library
// composer is owner only. Clients and families reach the readers from their
// own menus.
function coachSections(role: Role): NavSection[] {
  const surface: NavItem[] = [PROGRAM, FITNESS, BOYS];
  if (role === "owner") surface.push(BUSINESS);
  const content: NavItem[] = [COACH_ALONGSIDE];
  if (role === "owner") content.unshift(LIBRARY_COMPOSER);
  return [{ label: "Surface", items: surface }, { label: "Content", items: content }, WORKSPACE];
}

const CLIENT_HOME: NavItem = { href: "/home", label: "Home", icon: House };
const CLIENT_TRAINING: NavItem = { href: "/training", label: "Training", icon: Dumbbell };
const CLIENT_LOG: NavItem = { href: "/log", label: "Log", icon: NotebookPen };
const CLIENT_PROGRESS: NavItem = { href: "/progress", label: "Progress", icon: TrendingUp };
const FROM_YOUR_COACH: NavItem = {
  href: "/from-your-coach",
  label: "Alongside",
  icon: Footprints,
  hint: "From your coach",
};
const TRAILHEAD_READER: NavItem = {
  href: "/trailhead",
  label: "Trailhead Library",
  icon: BookOpen,
  hint: "Reads and the weekly challenge",
  short: "Library",
};

const CLIENT_SECTIONS: NavSection[] = [
  {
    label: "Menu",
    items: [CLIENT_HOME, CLIENT_TRAINING, CLIENT_LOG, CLIENT_PROGRESS, FROM_YOUR_COACH, TRAILHEAD_READER],
  },
  WORKSPACE,
];

const FAMILY: NavItem = {
  href: "/family",
  label: "My family",
  icon: Backpack,
  hint: "The boys program",
  short: "Family",
};

// A parent sees their family view, the library, messages, and settings.
const PARENT_SECTIONS: NavSection[] = [
  { label: "Menu", items: [FAMILY, FROM_YOUR_COACH, TRAILHEAD_READER, MESSAGES] },
  { items: [SETTINGS] },
];

export function sectionsForRole(role: Role): NavSection[] {
  if (role === "owner" || role === "coach") return coachSections(role);
  if (role === "parent") return PARENT_SECTIONS;
  return CLIENT_SECTIONS;
}

// The bottom bar carries the daily loop; everything else lives one tap away
// in the More sheet. Four tabs plus More, never more.
export function mobileNavForRole(role: Role): MobileNavSplit {
  if (role === "owner") {
    return {
      tabs: [PROGRAM, FITNESS, BUSINESS, MESSAGES],
      more: [BOYS, LIBRARY_COMPOSER, COACH_ALONGSIDE, SETTINGS],
    };
  }
  if (role === "coach") {
    return {
      tabs: [PROGRAM, FITNESS, BOYS, MESSAGES],
      more: [COACH_ALONGSIDE, SETTINGS],
    };
  }
  if (role === "parent") {
    return {
      tabs: [FAMILY, MESSAGES, FROM_YOUR_COACH, TRAILHEAD_READER],
      more: [SETTINGS],
    };
  }
  return {
    tabs: [CLIENT_HOME, CLIENT_TRAINING, CLIENT_LOG, MESSAGES],
    more: [CLIENT_PROGRESS, FROM_YOUR_COACH, TRAILHEAD_READER, SETTINGS],
  };
}
