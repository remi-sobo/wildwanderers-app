import { EmptyState } from "@/components/ui/EmptyState";
import { Wrench } from "lucide-react";

export default function TasksPlaceholder() {
  return (
    <EmptyState icon={Wrench} title="Coming right up.">
      This surface is being built in this ring.
    </EmptyState>
  );
}
