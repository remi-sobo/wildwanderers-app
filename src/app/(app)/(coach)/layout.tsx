import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";

// Guard only. The shell chrome comes from the parent (app) layout. Owner and
// coach pass; a client is redirected to their home.
export default async function CoachGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwnerOrCoach();
  return <>{children}</>;
}
