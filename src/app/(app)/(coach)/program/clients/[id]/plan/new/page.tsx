import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getClientById, clientName } from "@/lib/data/clients";
import { getExerciseLibrary } from "@/lib/data/exercises";
import { getPlanWithWorkoutsById } from "@/lib/data/plans";
import { getPlanTemplates } from "@/lib/data/templates";
import { PlanBuilder, type BuilderInitial } from "@/components/coach/PlanBuilder";
import { TemplateStartPicker } from "@/components/coach/TemplateStartPicker";

export const metadata = { title: "Build a plan — Wild Wanderers" };

export default async function NewPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const [{ id }, { draft: draftId }] = await Promise.all([params, searchParams]);
  const client = await getClientById(id);
  if (!client) notFound();

  const [library, templates] = await Promise.all([
    getExerciseLibrary(),
    // The start-from picker only makes sense on a fresh build.
    draftId ? Promise.resolve([]) : getPlanTemplates({ activeOnly: true }),
  ]);

  // ?draft= opens a resting draft for review. Only this client's own
  // draft/pending_review plans qualify; anything else 404s rather than
  // silently opening a fresh builder.
  let initial: BuilderInitial | undefined;
  if (draftId) {
    const plan = await getPlanWithWorkoutsById(draftId);
    if (
      !plan ||
      plan.client_id !== id ||
      (plan.status !== "draft" && plan.status !== "pending_review")
    ) {
      notFound();
    }
    initial = {
      planId: plan.id,
      title: plan.title,
      goal: plan.goal ?? "",
      durationWeeks: plan.duration_weeks != null ? String(plan.duration_weeks) : "",
      aiGenerated: plan.ai_generated,
      clientInitiated: plan.initiated_by === "client",
      workouts: plan.workouts.map((w) => ({
        weekNumber: w.week_number,
        dayNumber: w.day_number,
        title: w.title ?? "",
        exercises: w.exercises.map((ex) => ({
          title: ex.title,
          kind: ex.kind,
          sets: ex.sets != null ? String(ex.sets) : "",
          reps: ex.reps ?? "",
          load: ex.load ?? "",
          libraryItemId: ex.library_item_id,
          mediaUrl: ex.media_url ?? "",
        })),
      })),
    };
  }

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
          {initial ? "Review the draft" : "Build a plan"}
        </h1>
      </div>
      {!initial ? <TemplateStartPicker clientId={id} templates={templates} /> : null}
      <PlanBuilder clientId={id} library={library} initial={initial} />
    </div>
  );
}
