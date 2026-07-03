import { requireUser } from "@/lib/auth/require-user";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

export const dynamic = "force-dynamic";

// The app shell shared by both surfaces: a forest-deep left rail wrapping a
// bone workspace. Role-specific access is enforced by the (coach) and (client)
// sub-layouts; here we only need a signed-in user and their profile to draw the
// rail and route its nav by role.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireUser();
  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    "Your workspace";

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar role={profile.role} displayName={displayName} email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
