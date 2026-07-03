import type { LucideIcon } from "lucide-react";

// The encouraging empty state. Offers the next step, never an apology.
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[color:var(--border-hair)] bg-card px-8 py-16 text-center shadow-[var(--shadow-card)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-inset text-forest">
        <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-[family-name:var(--font-display)] text-[20px] leading-tight text-forest-deep">
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-[14.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
        {children}
      </p>
    </div>
  );
}
