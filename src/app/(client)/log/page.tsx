import { NotebookPen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LogPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
        Log
      </h1>
      <EmptyState icon={NotebookPen} title="Log what you did.">
        Weight, meals, movement, and habits will go here. The tracking tools
        arrive in a later build, and everything you log stays private to you and
        Gabe.
      </EmptyState>
    </div>
  );
}
