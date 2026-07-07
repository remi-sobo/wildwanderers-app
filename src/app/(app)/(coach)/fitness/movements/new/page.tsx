import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ExerciseComposer } from "@/components/coach/ExerciseComposer";

export default function NewMovementPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/fitness/movements"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest max-md:min-h-[44px]"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Movements
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Add a movement
        </h1>
      </div>
      <ExerciseComposer mode="create" />
    </div>
  );
}
