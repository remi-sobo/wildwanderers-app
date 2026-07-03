import { NotebookPen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LogPage() {
  return (
    <EmptyState icon={NotebookPen} title="Log what you did.">
      Weight, meals, movement, and habits will go here. The tracking tools arrive
      in a later build, and everything you log stays private to you and Gabe.
    </EmptyState>
  );
}
