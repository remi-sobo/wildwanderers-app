"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GitBranch, Wallet, ListChecks } from "lucide-react";

const TABS = [
  { href: "/business", label: "Dashboard", icon: LayoutDashboard },
  { href: "/business/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/business/finance", label: "Finance", icon: Wallet },
  { href: "/business/tasks", label: "Tasks", icon: ListChecks },
];

// The Business sub-nav. A pill row across the top of every business page.
export function BusinessNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => {
        const active = t.href === "/business" ? pathname === "/business" : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors max-md:min-h-[44px] ${
              active
                ? "bg-forest text-bone"
                : "border border-[color:var(--border-strong)] bg-card text-[color:var(--color-text)] hover:border-forest"
            }`}
          >
            <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
