import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function FitnessPage() {
  return (
    <EmptyState icon={Activity} title="Wellness lives here.">
      Measurements, habits, and the wellness score will read from this surface
      once clients start logging. It is a progress signal, never a medical
      assessment.
    </EmptyState>
  );
}
