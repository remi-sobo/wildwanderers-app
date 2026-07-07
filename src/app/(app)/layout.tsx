import { requireUser } from "@/lib/auth/require-user";
import { getMyOrg } from "@/lib/data/org";
import { orgThemeStyle } from "@/lib/brand/theme";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { TrailTexture } from "@/components/brand/TrailTexture";

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
  const [{ profile, email }, org] = await Promise.all([requireUser(), getMyOrg()]);
  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    "Your workspace";

  return (
    <div
      className="relative flex min-h-dvh bg-canvas"
      style={orgThemeStyle(org?.primary_color ?? null, org?.secondary_color ?? null)}
    >
      {/* Persistent brand scenery, bottom-right, behind the workspace cards. */}
      <TrailTexture className="pointer-events-none fixed bottom-0 right-0 z-0 h-auto w-[80vw] max-w-[1100px]" />
      <Sidebar
        role={profile.role}
        displayName={displayName}
        email={email}
        orgName={org?.name ?? "Wild Wanderers"}
        orgLogoUrl={org?.logo_url ?? undefined}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
