import { getLeads, getCustomers, getLeadWorkspace } from "@/lib/data/business";
import { PipelineBoard } from "@/components/coach/PipelineBoard";

export default async function PipelinePage() {
  const [leads, customers, workspace] = await Promise.all([
    getLeads(),
    getCustomers(),
    getLeadWorkspace(),
  ]);
  return <PipelineBoard leads={leads} customers={customers} workspace={workspace} />;
}
