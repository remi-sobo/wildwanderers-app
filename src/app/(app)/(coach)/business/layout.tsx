import { requireOwner } from "@/lib/auth/require-owner";
import { BusinessNav } from "@/components/coach/BusinessNav";

// The Business sub-shell. Owner-only, so a coach who reaches a /business URL is
// sent back to Program. Every business page gets the sub-nav.
export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-bark">Business</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          Run the business.
        </h1>
      </div>
      <BusinessNav />
      {children}
    </div>
  );
}
