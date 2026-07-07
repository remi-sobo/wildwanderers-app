"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, { title: string; context: string }> = {
  "/program": { title: "Program", context: "Clients and training plans" },
  "/fitness": { title: "Fitness", context: "Wellness and tracking" },
  "/business": { title: "Business", context: "The business switch" },
  "/boys": { title: "Dads & Kids", context: "The boys program" },
  "/family": { title: "My family", context: "The boys program" },
  "/library": { title: "Trailhead Library", context: "Your living content library" },
  "/trailhead": { title: "Trailhead Library", context: "Reads, links, and the weekly challenge" },
  "/alongside": { title: "Alongside", context: "Share your own week" },
  "/from-your-coach": { title: "Alongside", context: "From your coach" },
  "/home": { title: "Home", context: "" },
  "/training": { title: "Training", context: "" },
  "/log": { title: "Log", context: "" },
  "/progress": { title: "Progress", context: "" },
  "/messages": { title: "Messages", context: "" },
  "/settings": { title: "Settings", context: "" },
};

// The workspace header. On phones the sidebar is gone, so the org mark rides
// here and keeps the brand on screen; safe-area padding clears the notch when
// the app is installed to the home screen.
export function TopBar({
  activePath,
  orgName = "Wild Wanderers",
  orgLogoUrl,
}: {
  activePath?: string;
  orgName?: string;
  orgLogoUrl?: string;
}) {
  const pathname = usePathname();
  const current = activePath ?? pathname;
  const match =
    Object.entries(TITLES).find(([href]) => current.startsWith(href))?.[1] ??
    { title: "", context: "" };

  return (
    <header className="sticky top-0 z-10 border-b border-[color:var(--border-hair)] bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3.5 md:px-8 md:py-4">
        {orgLogoUrl ? (
          <img
            src={orgLogoUrl}
            alt={orgName}
            width={30}
            height={19}
            className="w-[30px] shrink-0 md:hidden"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate font-[family-name:var(--font-display)] text-[21px] leading-none text-forest-deep md:text-[24px]">
            {match.title}
          </h1>
          {match.context ? (
            <p className="mt-1 truncate text-[12.5px] text-[color:var(--color-text-muted)]">
              {match.context}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
