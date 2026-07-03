import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
        Progress
      </h1>
      <EmptyState icon={TrendingUp} title="Watch your progress build.">
        Your streaks, graphs, and wellness score show up here as you log. It is a
        picture of your progress, moving in your direction.
      </EmptyState>
    </div>
  );
}
