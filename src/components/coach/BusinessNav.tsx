"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LayoutDashboard, GitBranch, Mail, Wallet, Target, ChartColumn } from "lucide-react";

const TABS = [
  { href: "/business", label: "Dashboard", icon: LayoutDashboard },
  { href: "/business/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/business/popup", label: "Pop-up list", icon: Mail },
  { href: "/business/finance", label: "Finance", icon: Wallet },
  { href: "/business/goals", label: "Goals", icon: Target },
];

// Under the owner HQ layout /business is the launchpad, so the dashboard
// tab becomes Numbers at its own address. Every other tab is unchanged.
const HQ_TABS = [{ href: "/business/numbers", label: "Numbers", icon: ChartColumn }, ...TABS.slice(1)];

// The Business sub-nav. A pill row across the top of every business page.
// With hq on it hides on the launchpad itself and leads with a way back.
export function BusinessNav({ hq = false }: { hq?: boolean }) {
  const pathname = usePathname();
  if (hq && pathname === "/business") return null;
  const tabs = hq ? HQ_TABS : TABS;
  const pills = (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
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
  if (!hq) return pills;
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/business"
        className="inline-flex min-h-[44px] w-fit items-center gap-1 text-[14px] font-semibold text-forest md:min-h-0"
      >
        <ChevronLeft size={17} strokeWidth={2} aria-hidden="true" />
        Business
      </Link>
      {pills}
    </div>
  );
}
