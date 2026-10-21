import { getBusinessDashboard } from "@/lib/data/business";
import { getBusinessHome } from "@/lib/data/business-home";
import { getMyOrg } from "@/lib/data/org";
import { requireOwner } from "@/lib/auth/require-owner";
import { getOwnerHq } from "@/lib/flags/owner-hq";
import { BusinessDashboardView } from "@/components/coach/BusinessDashboardView";
import { BusinessHome } from "@/components/coach/BusinessHome";

// Classic layout: the dashboard. Owner HQ layout: the launchpad, with the
// dashboard one tap away at /business/numbers.
export default async function BusinessDashboardPage() {
  const { profile, email } = await requireOwner();
  const { active: hq } = await getOwnerHq(profile.role);

  if (hq) {
    const [data, org] = await Promise.all([getBusinessHome(), getMyOrg()]);
    const displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Your workspace";
    return (
      <BusinessHome data={data} orgName={org?.name ?? "Wild Wanderers"} displayName={displayName} email={email} />
    );
  }

  const data = await getBusinessDashboard();
  return <BusinessDashboardView data={data} />;
}
