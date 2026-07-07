import { Footprints } from "lucide-react";
import { getCoachFeed } from "@/lib/data/coach-shares";
import { CoachShareCard } from "@/components/client/CoachShareCard";
import { EmptyState } from "@/components/ui/EmptyState";

// Alongside, the reader. Clients and families see how the coach's week is going,
// the other side of the loop they already share into. RLS shows a family only
// the everyone-tier notes.
export default async function FromYourCoachPage() {
  const feed = await getCoachFeed();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-bark">Alongside</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          From your coach.
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
          You show up and share your work. Here is the coach&apos;s, and how the week
          is going. We are in it together.
        </p>
      </div>

      {feed.length === 0 ? (
        <EmptyState icon={Footprints} title="Nothing shared yet.">
          When your coach shares how their week is going, it shows up here.
        </EmptyState>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4">
          {feed.map((s) => (
            <CoachShareCard key={s.id} share={s} />
          ))}
        </div>
      )}
    </div>
  );
}
