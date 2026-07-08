"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/get-profile";
import { Contours } from "@/components/brand/Contours";
import { sectionsForRole } from "./nav";
import { SignOutButton } from "./SignOutButton";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "WW";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// The desktop rail. On phones the shell hands navigation to MobileNav's
// bottom tab bar instead, so this renders md-and-up only and the full
// viewport width belongs to the work.
export function Sidebar({
  role,
  displayName,
  email,
  orgName = "Wild Wanderers",
  orgLogoUrl = "/brand/mark-bone.png",
  activePath,
}: {
  role: Role;
  displayName: string;
  email: string | null;
  orgName?: string;
  orgLogoUrl?: string;
  activePath?: string;
}) {
  const pathname = usePathname();
  const current = activePath ?? pathname;
  const sections = sectionsForRole(role);

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-[248px] shrink-0 flex-col self-start overflow-hidden bg-chrome text-bone md:flex">
      <Contours className="pointer-events-none absolute inset-x-0 top-20 text-mist/10" />

      {/* Brand. The org's mark carries the identity beside the org name.
          Seeded with the Wild Wanderers mark; a second org's logo_url takes
          over without touching this file. */}
      <div className="relative z-10 flex items-center gap-3 px-5 pb-2 pt-7">
        <img src={orgLogoUrl} alt={orgName} width={34} height={21} className="w-[34px] shrink-0" />
        <div>
          <p className="font-[family-name:var(--font-display)] text-[19px] font-medium leading-none text-bone">
            {orgName}
          </p>
          <p className="eyebrow mt-1.5 text-[9.5px] tracking-[0.28em] text-bone/60">
            Fitness
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 mt-4 flex-1 overflow-y-auto px-3">
        {sections.map((section) => (
          <div key={section.label ?? "nav"} className="mb-4">
            {section.label ? (
              <p className="eyebrow px-3 pb-2 text-[10px] text-bone/45">{section.label}</p>
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
      <div className="relative z-10 mt-auto border-t border-bone/10 px-4 py-5">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bone/[0.1] text-[12px] font-semibold text-bone/90">
            {initials(displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-bone/90">{displayName}</p>
            {email ? <p className="truncate text-[11.5px] text-bone/50">{email}</p> : null}
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
