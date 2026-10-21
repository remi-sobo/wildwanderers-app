import { redirect } from "next/navigation";
import { getSessionProfile, surfaceForRole, type Profile } from "./get-profile";

// Guards the advisor workspace. Only an advisor passes; everyone else goes to
// their own surface, anyone signed out to login. The database is the real
// boundary (advisor_* RLS and the advisor_* functions); this is the door.
export async function requireAdvisor(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role !== "advisor") redirect(surfaceForRole(profile.role));
  return { userId: session.userId, email: session.email, profile };
}
