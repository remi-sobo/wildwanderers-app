import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getClientById, clientName } from "@/lib/data/clients";
import { PlanBuilder } from "@/components/coach/PlanBuilder";

export const metadata = { title: "Build a plan — Wild Wanderers" };

export default async function NewPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/program/clients/${id}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {clientName(client)}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Build a plan
        </h1>
      </div>
      <PlanBuilder clientId={id} />
    </div>
  );
}
