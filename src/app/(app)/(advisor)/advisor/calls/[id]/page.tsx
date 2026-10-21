import { notFound } from "next/navigation";
import { getCall } from "@/lib/data/advisor-calls";
import { getAdvisorWorkspace } from "@/lib/data/advisor";
import { CallReview } from "@/components/advisor/CallReview";

// One call: review, send, and the record. An expired or someone else's
// call is simply not found.
export default async function AdvisorCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [call, workspace] = await Promise.all([getCall(id), getAdvisorWorkspace()]);
  if (!call) notFound();
  const taskTitles = Object.fromEntries(workspace.tasks.filter((t) => !t.masked).map((t) => [t.id, t.title]));
  return (
    <CallReview call={call} ownerName={workspace.org?.owner_first_name || "the owner"} taskTitles={taskTitles} />
  );
}
