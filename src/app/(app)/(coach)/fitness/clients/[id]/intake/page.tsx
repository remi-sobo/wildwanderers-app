import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getClientById, clientName } from "@/lib/data/clients";
import { getClientIntake, getClientFlags } from "@/lib/data/intake";
import { getClientLongevity } from "@/lib/data/longevity";
import { IntakeScreen } from "@/components/coach/IntakeScreen";
import { FlagsBand } from "@/components/coach/FlagsBand";
import { ClientLongevityPanel } from "@/components/coach/ClientLongevityPanel";

// The guided intake: filled while talking with the client, built for speed
// mid-conversation. Four sections: the goal in their words, the story, the
// movement baseline (the same battery as every later assessment, marked as
// day one), and lifestyle basics. Typed notes only, by decision; no
// recording of the conversation.

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const [intake, flags, longevity] = await Promise.all([
    getClientIntake(id),
    getClientFlags(id),
    getClientLongevity(id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href={`/fitness/clients/${id}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest max-md:min-h-[44px]"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {clientName(client)}
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Intake
        </h1>
        <p className="mt-1 max-w-xl text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
          Fill it while you talk. Every section saves on its own, and anything
          worth knowing every session gets promoted to a flag.
        </p>
      </div>

      <FlagsBand clientId={id} flags={flags} variant="full" />

      <IntakeScreen clientId={id} initialGoal={client.goal ?? ""} intake={intake} />

      {/* The movement baseline: their first assessment session, the same
          battery as every later one. Day one becomes data point one. */}
      <section className="flex flex-col gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
            The movement baseline
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
            Record what you test today. It lands as their first data point in
            the same battery as every later assessment.
          </p>
        </div>
        <ClientLongevityPanel
          clientId={id}
          longevity={longevity}
          recordContext="intake_baseline"
          startOpen
        />
      </section>
    </div>
  );
}
