"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Backpack,
  Briefcase,
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
import { Contours } from "@/components/brand/Contours";
import { SignOutButton } from "./SignOutButton";

type NavItem = { href: string; label: string; icon: LucideIcon; hint?: string };
type NavSection = { label?: string; items: NavItem[] };

const WORKSPACE: NavSection = {
  label: "Workspace",
  items: [
    { href: "/messages", label: "Messages", icon: MessageCircle },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
};

// Business is Gabe's back office, owner-only. A coach sees Program and Fitness.
function coachSections(role: Role): NavSection[] {
  const surface: NavItem[] = [
    { href: "/program", label: "Program", icon: ClipboardList, hint: "Clients and training" },
    { href: "/fitness", label: "Fitness", icon: Activity, hint: "Wellness and tracking" },
    { href: "/boys", label: "Dads & Kids", icon: Backpack, hint: "The boys program" },
  ];
  if (role === "owner") {
    surface.push({ href: "/business", label: "Business", icon: Briefcase, hint: "The business switch" });
  }
  return [{ label: "Surface", items: surface }, WORKSPACE];
}

const CLIENT_SECTIONS: NavSection[] = [
  {
    label: "Menu",
    items: [
      { href: "/home", label: "Home", icon: House },
      { href: "/training", label: "Training", icon: Dumbbell },
      { href: "/log", label: "Log", icon: NotebookPen },
      { href: "/progress", label: "Progress", icon: TrendingUp },
    ],
  },
  WORKSPACE,
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "WW";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Sidebar({
  role,
  displayName,
  email,
  activePath,
}: {
  role: Role;
  displayName: string;
  email: string | null;
  activePath?: string;
}) {
  const pathname = usePathname();
  const current = activePath ?? pathname;
  const sections =
    role === "owner" || role === "coach" ? coachSections(role) : CLIENT_SECTIONS;

  return (
    <aside className="sticky top-0 z-20 flex h-dvh w-16 shrink-0 flex-col self-start overflow-hidden bg-chrome text-bone md:w-[248px]">
      <Contours className="pointer-events-none absolute inset-x-0 top-20 text-mist/10" />

      {/* Brand */}
      <div className="relative z-10 flex items-center justify-center px-3 pb-2 pt-6 md:justify-start md:px-6 md:pt-7">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bone/[0.08] font-[family-name:var(--font-display)] text-[15px] text-cream md:hidden">
          WW
        </span>
        <div className="hidden md:block">
          <p className="font-[family-name:var(--font-display)] text-[19px] font-medium leading-none text-bone">
            Wild Wanderers
          </p>
          <p className="eyebrow mt-1.5 text-[9.5px] tracking-[0.28em] text-bone/60">
            Fitness
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 mt-4 flex-1 overflow-y-auto px-2 md:px-3">
        {sections.map((section) => (
          <div key={section.label ?? "nav"} className="mb-4">
            {section.label ? (
              <p className="eyebrow hidden px-3 pb-2 text-[10px] text-bone/45 md:block">
                {section.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active = current.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={item.label}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors max-md:justify-center ${
                        active ? "bg-bone/[0.08]" : "hover:bg-bone/[0.05]"
                      }`}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-amber"
                        />
                      ) : null}
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        aria-hidden="true"
                        className={active ? "text-amber" : "text-bone/70"}
                      />
                      <span className="hidden flex-col md:flex">
                        <span
                          className={`font-[family-name:var(--font-display)] text-[15px] leading-tight ${
                            active ? "text-bone" : "text-bone/85"
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.hint ? (
                          <span className="text-[11px] leading-tight text-bone/45">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="relative z-10 mt-auto border-t border-bone/10 px-2 py-4 md:px-4 md:py-5">
        <div className="mb-2 flex items-center gap-2.5 max-md:justify-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bone/[0.1] text-[12px] font-semibold text-bone/90">
            {initials(displayName)}
          </span>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-[13px] font-medium text-bone/90">{displayName}</p>
            {email ? <p className="truncate text-[11.5px] text-bone/50">{email}</p> : null}
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
