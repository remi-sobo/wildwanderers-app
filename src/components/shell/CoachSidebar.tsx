"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Briefcase, ClipboardList, type LucideIcon } from "lucide-react";
import { Contours } from "@/components/brand/Contours";
import { SignOutButton } from "./SignOutButton";

type Surface = { href: string; label: string; icon: LucideIcon; hint: string };

// The one place Gabe changes hats: Program, Fitness, Business.
const SURFACES: Surface[] = [
  { href: "/program", label: "Program", icon: ClipboardList, hint: "Clients and training" },
  { href: "/fitness", label: "Fitness", icon: Activity, hint: "Wellness and tracking" },
  { href: "/business", label: "Business", icon: Briefcase, hint: "The business switch" },
];

export function CoachSidebar({
  displayName,
  email,
}: {
  displayName: string;
  email: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="relative flex w-full shrink-0 flex-col overflow-hidden bg-chrome text-bone md:h-dvh md:w-[248px]">
      <Contours className="pointer-events-none absolute inset-x-0 top-16 text-mist/10" />

      <div className="relative z-10 px-6 pb-2 pt-7">
        <p className="font-[family-name:var(--font-display)] text-[19px] font-medium leading-none text-bone">
          Wild Wanderers
        </p>
        <p className="eyebrow mt-1.5 text-[9.5px] tracking-[0.28em] text-bone/60">
          Fitness
        </p>
      </div>

      <nav className="relative z-10 mt-6 px-3">
        <p className="eyebrow px-3 pb-2 text-[10px] text-bone/45">Surface</p>
        <ul className="flex flex-col gap-1">
          {SURFACES.map((s) => {
            const active = pathname.startsWith(s.href);
            const Icon = s.icon;
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
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
                  <span className="flex flex-col">
                    <span
                      className={`font-[family-name:var(--font-display)] text-[15px] leading-tight ${
                        active ? "text-bone" : "text-bone/85"
                      }`}
                    >
                      {s.label}
                    </span>
                    <span className="text-[11px] leading-tight text-bone/45">
                      {s.hint}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative z-10 mt-auto border-t border-bone/10 px-6 py-5">
        <p className="truncate text-[13px] font-medium text-bone/90">{displayName}</p>
        {email ? (
          <p className="truncate text-[11.5px] text-bone/50">{email}</p>
        ) : null}
        <SignOutButton className="mt-3" />
      </div>
    </aside>
  );
}
