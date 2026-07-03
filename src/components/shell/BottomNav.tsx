"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  House,
  MessageCircle,
  NotebookPen,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/log", label: "Log", icon: NotebookPen },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--border-hair)] bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 pb-[env(safe-area-inset-bottom)] pt-2 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-amber-deep"
                    : "text-[color:var(--color-text-muted)]"
                }`}
              >
                <Icon
                  size={21}
                  strokeWidth={active ? 2.1 : 1.75}
                  aria-hidden="true"
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
