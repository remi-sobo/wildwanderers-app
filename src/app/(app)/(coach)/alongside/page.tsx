import Link from "next/link";
import { Plus } from "lucide-react";
import { getManagedShares, getCoachCadence } from "@/lib/data/coach-shares";
import { ShareManager } from "@/components/coach/ShareManager";

// Alongside: Gabe shares his own week back to his people, so the coaching runs
// both ways. Owner and coach compose here (the coach layout guards the route);
// clients and families read it on their side.
export default async function AlongsidePage() {
  const [shares, cadence] = await Promise.all([getManagedShares(), getCoachCadence()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-bark">Alongside</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
            Share your own week.
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
            They show you their workouts. This is where they see yours, and how the
            week is going. Lead by showing. Your voice, always.
          </p>
        </div>
        <Link
          href="/alongside/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-5 py-2.5 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep max-md:min-h-[44px]"
        >
          <Plus size={16} aria-hidden="true" />
          Share a note
        </Link>
      </div>

      <ShareManager shares={shares} cadence={cadence} />
    </div>
  );
}
