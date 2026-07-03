import { Dumbbell } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TrainingPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
        Training
      </h1>
      <EmptyState icon={Dumbbell} title="Your workouts land here.">
        When your plan is ready, each workout shows up with everything you need
        for the day. Check back soon.
      </EmptyState>
    </div>
  );
}
