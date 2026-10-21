import { requireOwner } from "@/lib/auth/require-owner";
import { getOwnerHq } from "@/lib/flags/owner-hq";
import { BusinessNav } from "@/components/coach/BusinessNav";

// The Business sub-shell. Owner-only, so a coach who reaches a /business URL is
// sent back to Program. Every business page gets the sub-nav. Under the owner
// HQ layout /business is the launchpad with its own header, and every other
// business page gets a way back to it above the same sub-nav.
export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireOwner();
  const { active: hq } = await getOwnerHq(profile.role);

  if (hq) {
    return (
      <div className="flex flex-col gap-6">
        <BusinessNav hq />
        {children}
      </div>
    );
  }

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
