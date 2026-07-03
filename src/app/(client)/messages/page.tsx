import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
        Messages
      </h1>
      <EmptyState icon={MessageCircle} title="Talk with Gabe here.">
        Your check-ins and messages with Gabe will live on this screen. Messaging
        opens up in a later build.
      </EmptyState>
    </div>
  );
}
