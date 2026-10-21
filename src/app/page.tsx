import { redirect } from "next/navigation";
import { getSessionProfile, surfaceForRole } from "@/lib/auth/get-profile";
import { getOwnerHq } from "@/lib/flags/owner-hq";

// Routes a signed-in user to their surface by role. The middleware has already
// bounced anyone without a session to /login.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const role = session.profile?.role;
  const { active } = await getOwnerHq(role);
  redirect(surfaceForRole(role, { ownerHq: active }));
}
