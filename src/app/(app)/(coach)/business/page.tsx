import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function BusinessPage() {
  return (
    <EmptyState icon={Briefcase} title="The business switch.">
      Revenue, offerings, the client pipeline, and tasks come together here when
      the business ring is built. For now the shell is ready and waiting.
    </EmptyState>
  );
}
