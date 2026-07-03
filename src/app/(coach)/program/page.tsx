import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProgramPage() {
  return (
    <EmptyState icon={Users} title="Your clients gather here.">
      Add your first client and their training plans, workouts, and progress show
      up in Program. That work starts in the next build.
    </EmptyState>
  );
}
