import { getFinance } from "@/lib/data/business";
import { FinancePanel } from "@/components/coach/FinancePanel";

export default async function FinancePage() {
  const data = await getFinance();
  return <FinancePanel data={data} />;
}
