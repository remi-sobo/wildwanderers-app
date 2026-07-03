"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, { title: string; context: string }> = {
  "/program": { title: "Program", context: "Clients and training plans" },
  "/fitness": { title: "Fitness", context: "Wellness and tracking" },
  "/business": { title: "Business", context: "The business switch" },
  "/home": { title: "Home", context: "" },
  "/training": { title: "Training", context: "" },
  "/log": { title: "Log", context: "" },
  "/progress": { title: "Progress", context: "" },
  "/messages": { title: "Messages", context: "" },
  "/settings": { title: "Settings", context: "" },
};

export function TopBar({ activePath }: { activePath?: string }) {
  const pathname = usePathname();
  const current = activePath ?? pathname;
  const match =
    Object.entries(TITLES).find(([href]) => current.startsWith(href))?.[1] ??
    { title: "", context: "" };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--border-hair)] bg-canvas/85 px-5 py-4 backdrop-blur md:px-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[22px] leading-none text-forest-deep md:text-[24px]">
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
