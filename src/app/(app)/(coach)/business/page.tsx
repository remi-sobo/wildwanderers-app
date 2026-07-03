import { getBusinessDashboard } from "@/lib/data/business";
import { BusinessDashboardView } from "@/components/coach/BusinessDashboardView";

export default async function BusinessDashboardPage() {
  const data = await getBusinessDashboard();
  return <BusinessDashboardView data={data} />;
}
