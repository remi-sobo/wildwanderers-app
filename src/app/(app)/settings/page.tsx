import { Settings } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <EmptyState icon={Settings} title="Settings live here.">
        Your account, profile, and preferences will be managed on this screen.
        Nothing to change yet.
      </EmptyState>
    </div>
  );
}
