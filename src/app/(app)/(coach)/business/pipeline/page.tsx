import { getLeads, getCustomers, getLeadWorkspace, getNewInquiries } from "@/lib/data/business";
import { PipelineBoard } from "@/components/coach/PipelineBoard";

export default async function PipelinePage() {
  const [leads, customers, workspace, inquiries] = await Promise.all([
    getLeads(),
    getCustomers(),
    getLeadWorkspace(),
    getNewInquiries(),
  ]);
  return (
    <PipelineBoard leads={leads} customers={customers} workspace={workspace} inquiries={inquiries} />
  );
}
