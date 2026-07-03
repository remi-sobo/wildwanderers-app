"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, { title: string; context: string }> = {
  "/program": { title: "Program", context: "Clients and training plans" },
  "/fitness": { title: "Fitness", context: "Wellness and tracking" },
  "/business": { title: "Business", context: "The business switch" },
};

export function CoachTopBar() {
  const pathname = usePathname();
  const match =
    Object.entries(TITLES).find(([href]) => pathname.startsWith(href))?.[1] ??
    { title: "Program", context: "" };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--border-hair)] bg-canvas/85 px-6 py-4 backdrop-blur md:px-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[24px] leading-none text-forest-deep">
          {match.title}
        </h1>
        {match.context ? (
          <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)]">
            {match.context}
          </p>
        ) : null}
      </div>
    </header>
  );
}
