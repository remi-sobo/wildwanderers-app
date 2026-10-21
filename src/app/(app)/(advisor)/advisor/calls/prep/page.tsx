import { getCalls, getCall } from "@/lib/data/advisor-calls";
import { getAdvisorWorkspace } from "@/lib/data/advisor";
import { buildAgenda } from "@/lib/advisor/calls";
import { CallPrep } from "@/components/advisor/CallPrep";

// Prep the next call: an agenda drafted from real work since the last
// call, saved with that call.
export default async function AdvisorPrepPage() {
  const [calls, workspace] = await Promise.all([getCalls(), getAdvisorWorkspace()]);
  const last = calls[0] ? await getCall(calls[0].id) : null;
  const draft = buildAgenda({
    ownerName: workspace.org?.owner_first_name || "the owner",
    lastCallOn: last?.held_on ?? null,
    tasks: workspace.tasks,
    items: workspace.items,
  });
  return (
    <CallPrep draft={draft} saved={last?.agenda ?? null} lastCall={last ? { id: last.id, title: last.title } : null} />
  );
}
