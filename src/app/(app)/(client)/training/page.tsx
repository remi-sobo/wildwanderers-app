import { Dumbbell } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TrainingPage() {
  return (
    <EmptyState icon={Dumbbell} title="Your workouts land here.">
      When your plan is ready, each workout shows up with everything you need for
      the day. Check back soon.
    </EmptyState>
  );
}
