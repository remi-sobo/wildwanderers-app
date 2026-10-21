import { getCalls } from "@/lib/data/advisor-calls";
import { getAdvisorWorkspace } from "@/lib/data/advisor";
import { CallsHome } from "@/components/advisor/CallsHome";
import { AdvisorWork } from "@/components/advisor/AdvisorWork";

// Calls: past calls and Add a call. Guarded by the (advisor) layout; the
// database returns only the advisor's own unexpired calls.
export default async function AdvisorCallsPage() {
  const [calls, workspace] = await Promise.all([getCalls(), getAdvisorWorkspace()]);
  // No active relationship: the Work screen already explains that.
  if (!workspace.org) return <AdvisorWork workspace={workspace} />;
  return (
    <CallsHome
      calls={calls}
      orgId={workspace.org.org_id}
      ownerName={workspace.org.owner_first_name || "The owner"}
    />
  );
}
