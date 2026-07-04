import Link from "next/link";
import { Activity, Settings2 } from "lucide-react";
import { getClients, clientName } from "@/lib/data/clients";
import { getClientWellness } from "@/lib/data/coach-fitness";
import { ClientWellnessDashboard } from "@/components/coach/ClientWellnessDashboard";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function FitnessPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const clients = await getClients();

  if (clients.length === 0) {
    return (
      <EmptyState icon={Activity} title="Wellness lives here.">
        Add a client and, once they start logging, their measurements, habits, and
        wellness score show up on this surface. It is a progress signal, never a
        medical assessment.
      </EmptyState>
    );
  }

  const selected = clients.find((cl) => cl.id === c) ?? clients[0];
  const wellness = await getClientWellness(selected.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-bark">Fitness</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
            Coach off real data.
          </h1>
        </div>
        <Link
          href="/fitness/assessments"
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-semibold text-forest transition-colors hover:bg-inset"
        >
          <Settings2 size={15} aria-hidden="true" />
          Assessment tests
        </Link>
      </div>

      {/* Client picker */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {clients.map((cl) => {
          const active = cl.id === selected.id;
          return (
            <Link
              key={cl.id}
              href={`/fitness?c=${cl.id}`}
              scroll={false}
              className={`shrink-0 rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors ${
                active
                  ? "border-forest bg-forest text-bone"
                  : "border-[color:var(--border-strong)] bg-card text-[color:var(--color-text)] hover:border-forest"
              }`}
            >
              {clientName(cl)}
            </Link>
          );
        })}
      </div>

      <ClientWellnessDashboard data={wellness} />
    </div>
  );
}
