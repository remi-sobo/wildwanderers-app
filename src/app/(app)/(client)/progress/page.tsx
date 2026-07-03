import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProgressPage() {
  return (
    <EmptyState icon={TrendingUp} title="Watch your progress build.">
      Your streaks, graphs, and wellness score show up here as you log. It is a
      picture of your progress, moving in your direction.
    </EmptyState>
  );
}
