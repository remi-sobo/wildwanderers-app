import { getAdvisorWorkspace } from "@/lib/data/advisor";
import { AdvisorWork } from "@/components/advisor/AdvisorWork";

// The advisor workspace: Work. Guarded by the (advisor) layout; the
// database decides what the advisor can read.
export default async function AdvisorHomePage() {
  const workspace = await getAdvisorWorkspace();
  return <AdvisorWork workspace={workspace} />;
}
