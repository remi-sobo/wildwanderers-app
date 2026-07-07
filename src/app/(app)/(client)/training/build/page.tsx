import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getExerciseLibrary } from "@/lib/data/exercises";
import { SelfWorkoutBuilder } from "@/components/client/SelfWorkoutBuilder";

export const metadata = { title: "Build a workout — Wild Wanderers" };

// The client's own workout builder. RLS hands a client only the active
// movements, and everything saved here stays in their own lane beside the
// coach's plan, never replacing it.
export default async function BuildWorkoutPage() {
  const library = await getExerciseLibrary();

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
      <SelfWorkoutBuilder library={library} />
    </div>
  );
}
