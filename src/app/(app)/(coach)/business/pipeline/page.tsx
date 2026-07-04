import { getLeads, getCustomers } from "@/lib/data/business";
import { PipelineBoard } from "@/components/coach/PipelineBoard";

export default async function PipelinePage() {
  const [leads, customers] = await Promise.all([getLeads(), getCustomers()]);
  return <PipelineBoard leads={leads} customers={customers} />;
}
