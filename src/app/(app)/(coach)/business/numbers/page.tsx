import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/require-owner";
import { getOwnerHq } from "@/lib/flags/owner-hq";
import { getBusinessDashboard } from "@/lib/data/business";
import { BusinessDashboardView } from "@/components/coach/BusinessDashboardView";

// Numbers: the business dashboard under the owner HQ layout, where
// /business itself becomes the launchpad. Same reader, same view. In
// the classic layout the dashboard still lives at /business, so this
// address sends you there.
export default async function BusinessNumbersPage() {
  const { profile } = await requireOwner();
  const { active } = await getOwnerHq(profile.role);
  if (!active) redirect("/business");
  const data = await getBusinessDashboard();
  return <BusinessDashboardView data={data} />;
}
