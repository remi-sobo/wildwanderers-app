import Link from "next/link";
import { ChevronLeft, LayoutTemplate } from "lucide-react";
import { getExerciseLibrary } from "@/lib/data/exercises";
import { getPlanTemplates, getTemplateWithWorkouts } from "@/lib/data/templates";
import {
  SelfWorkoutBuilder,
  type BuilderStart,
} from "@/components/client/SelfWorkoutBuilder";

export const metadata = { title: "Build a workout — Wild Wanderers" };

// The client's own builder. RLS hands a client only the active movements and
// the templates Gabe chose to share; everything saved here stays in their own
// lane beside the coach's plan, never replacing it.
export default async function BuildWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const [library, templates] = await Promise.all([
    getExerciseLibrary(),
    // RLS filters to the shared, active templates for a client.
    getPlanTemplates({ activeOnly: true }),
  ]);

  // Starting from one of Gabe's shared templates prefills the builder; the
  // client edits and saves through their own lane. Seven days is the cap, so
  // a deeper template offers its first week.
  let initial: BuilderStart | undefined;
  let trimmed = false;
  if (from) {
    const template = await getTemplateWithWorkouts(from);
    if (template) {
      const days = template.workouts.slice(0, 7).map((w) => ({
        title: w.title ?? "",
        exercises: w.exercises.map((e) => ({
          title: e.title,
          kind: e.kind,
          sets: e.sets != null ? String(e.sets) : "",
          reps: e.reps ?? "",
          load: e.load ?? "",
          libraryItemId: e.library_item_id,
          mediaUrl: e.media_url ?? "",
        })),
      }));
      if (days.length > 0) {
        initial = { title: template.title, days };
        trimmed = template.workouts.length > 7;
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/training"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Training
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          Build your own workout
        </h1>
        <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
          Pick movements from the library and make it yours. It sits beside your
          coach&apos;s plan, and you can send it to your coach for a look any time.
        </p>
      </div>

      {!initial && templates.length > 0 ? (
        <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={15} className="text-forest" aria-hidden="true" />
            <p className="eyebrow text-bark">Start from one of your coach&apos;s templates</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/training/build?from=${t.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-semibold text-forest transition-colors hover:bg-inset"
              >
                {t.title}
                <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                  {t.workout_count} {t.workout_count === 1 ? "day" : "days"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {trimmed ? (
        <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
          This template runs deeper than a week, so here is its first seven days.
        </p>
      ) : null}

      <SelfWorkoutBuilder library={library} initial={initial} />
    </div>
  );
}
