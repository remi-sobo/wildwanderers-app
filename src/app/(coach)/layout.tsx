import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { CoachSidebar } from "@/components/shell/CoachSidebar";
import { CoachTopBar } from "@/components/shell/CoachTopBar";

export const dynamic = "force-dynamic";

// The coach and business shell. Owner and coach share it. Forest-deep rail
// wrapping a bone workspace.
export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireOwnerOrCoach();
  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    "Your workspace";

  return (
    <div className="flex min-h-dvh flex-col bg-canvas md:flex-row">
      <CoachSidebar displayName={displayName} email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CoachTopBar />
        <main className="flex-1 px-6 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
