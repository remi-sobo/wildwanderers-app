"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, X } from "lucide-react";
import type { Role } from "@/lib/auth/get-profile";
import { mobileNavForRole } from "./nav";
import { SignOutButton } from "./SignOutButton";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "WW";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// The phone shell: a forest-deep bottom tab bar carrying the role's daily
// loop, with the rest of the map one tap away in a bottom sheet. Replaces the
// old collapsed icon rail, so the full viewport width belongs to the work.
export function MobileNav({
  role,
  displayName,
  email,
}: {
  role: Role;
  displayName: string;
  email: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { tabs, more } = mobileNavForRole(role);

  // The sheet never outlives a navigation, and Escape always closes it.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const moreActive = more.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* The More sheet */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full animate-[ww-fade-in_0.18s_ease-out] bg-ink/50"
          />
          <div
            ref={sheetRef}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 animate-[ww-sheet-up_0.22s_ease-out] rounded-t-2xl bg-chrome pb-[env(safe-area-inset-bottom)] text-bone shadow-[0_-12px_40px_rgba(30,51,31,0.35)] outline-none"
          >
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-bone/20" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-m-2 flex h-11 w-11 items-center justify-center rounded-full text-bone/70"
              >
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <nav className="px-3 pb-2">
              <ul className="flex flex-col">
                {more.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-[52px] items-center gap-3.5 rounded-xl px-3 py-2.5 ${
                          active ? "bg-bone/[0.08]" : "active:bg-bone/[0.06]"
                        }`}
                      >
                        <Icon
                          size={20}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className={active ? "text-amber" : "text-bone/70"}
                        />
                        <span className="flex flex-col">
                          <span
                            className={`font-[family-name:var(--font-display)] text-[16px] leading-tight ${
                              active ? "text-bone" : "text-bone/85"
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.hint ? (
                            <span className="text-[11.5px] leading-tight text-bone/45">{item.hint}</span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="border-t border-bone/10 px-5 py-4">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bone/[0.1] text-[12px] font-semibold text-bone/90">
                  {initials(displayName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-bone/90">{displayName}</p>
                  {email ? <p className="truncate text-[12px] text-bone/50">{email}</p> : null}
                </div>
              </div>
              <SignOutButton tall />
            </div>
          </div>
        </div>
      ) : null}

      {/* The tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-bone/10 bg-chrome pb-[env(safe-area-inset-bottom)] text-bone md:hidden"
      >
        <ul className="flex items-stretch">
          {tabs.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2"
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2 : 1.75}
                    aria-hidden="true"
                    className={active ? "text-amber" : "text-bone/65"}
                  />
                  <span
                    className={`max-w-full truncate text-[10.5px] font-medium leading-none ${
                      active ? "text-bone" : "text-bone/65"
                    }`}
                  >
                    {item.short ?? item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-haspopup="dialog"
              className="flex min-h-[58px] w-full flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2"
            >
              <Ellipsis
                size={22}
                strokeWidth={moreActive ? 2 : 1.75}
                aria-hidden="true"
                className={moreActive || open ? "text-amber" : "text-bone/65"}
              />
              <span
                className={`text-[10.5px] font-medium leading-none ${
                  moreActive || open ? "text-bone" : "text-bone/65"
                }`}
              >
                More
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
