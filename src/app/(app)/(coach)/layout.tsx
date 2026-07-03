import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { getClients, clientName } from "@/lib/data/clients";
import { coachConfigured } from "@/lib/ai/config";
import { CoachDock } from "@/components/coach/CoachDock";

// Guard plus the Coach dock. The shell chrome comes from the parent (app)
// layout. Owner and coach pass; a client is redirected to their home. Coach
// (the AI assistant) is Gabe's tool, so its floating button lives here on the
// coach shell only and never on the client surfaces.
export default async function CoachGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwnerOrCoach();
  const clients = await getClients();

  return (
    <>
      {children}
      <CoachDock
        configured={coachConfigured()}
        clients={clients.map((c) => ({ id: c.id, name: clientName(c) }))}
      />
    </>
  );
}
