import { MessageCircle } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { EmptyState } from "@/components/ui/EmptyState";

// Shared by both surfaces. The copy shifts with who is reading.
export default async function MessagesPage() {
  const session = await getSessionProfile();
  const isStaff =
    session?.profile?.role === "owner" || session?.profile?.role === "coach";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {isStaff ? (
        <EmptyState icon={MessageCircle} title="Your client conversations.">
          Check-ins and messages with your clients gather here. Messaging opens up
          in a later build.
        </EmptyState>
      ) : (
        <EmptyState icon={MessageCircle} title="Talk with Gabe here.">
          Your check-ins and messages with Gabe will live on this screen.
          Messaging opens up in a later build.
        </EmptyState>
      )}
    </div>
  );
}
