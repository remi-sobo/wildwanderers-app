import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getMovement } from "@/lib/data/exercises";
import { ExerciseComposer, type ComposerInitial } from "@/components/coach/ExerciseComposer";

export default async function EditMovementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMovement(id);
  if (!m) notFound();

  const initial: ComposerInitial = {
    id: m.id,
    title: m.title,
    kind: m.kind,
    muscleGroup: m.muscle_group ?? "",
    equipment: m.equipment ?? "",
    defaultSets: m.default_sets != null ? String(m.default_sets) : "",
    defaultReps: m.default_reps ?? "",
    cues: m.cues ?? "",
    instructions: m.instructions ?? "",
    mediaUrl: m.media_url ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/fitness/movements"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Movements
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Edit movement
        </h1>
        {m.usage_count > 0 ? (
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            Used in {m.usage_count} {m.usage_count === 1 ? "plan" : "plans"}. Edits apply going
            forward; existing prescriptions keep what they were set to.
          </p>
        ) : null}
      </div>
      <ExerciseComposer mode="edit" initial={initial} />
    </div>
  );
}
