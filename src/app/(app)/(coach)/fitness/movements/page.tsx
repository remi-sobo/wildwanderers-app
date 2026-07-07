import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { getManagedMovements } from "@/lib/data/exercises";
import { MovementsList } from "@/components/coach/MovementsList";

// The exercise library, Gabe's to edit. Owner and coach reach it (the coach
// layout guards the route; the write actions re-check). The plan builder pulls
// its picker from the active movements here.
export default async function MovementsPage() {
  const movements = await getManagedMovements();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/fitness"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Fitness
          </Link>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-forest-deep">
            Movements
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
            Your exercise library. Add movements, arrange them, and attach a demo
            video clients see while they train. Plans build from the active list.
          </p>
        </div>
        <Link
          href="/fitness/movements/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-5 py-2.5 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep"
        >
          <Plus size={16} aria-hidden="true" />
          Add movement
        </Link>
      </div>

      <MovementsList movements={movements} />
    </div>
  );
}
