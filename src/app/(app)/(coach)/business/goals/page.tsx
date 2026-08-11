import { getBusinessDashboard } from "@/lib/data/business";
import { GoalsPanel } from "@/components/coach/GoalsPanel";

export default async function GoalsPage() {
  const dashboard = await getBusinessDashboard();
  return <GoalsPanel goals={dashboard.goals} />;
}
