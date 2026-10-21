import { redirect } from "next/navigation";
import { getSessionProfile, surfaceForRole, type Profile } from "./get-profile";

// Guards the Business switch. Only the owner passes; everyone else goes to their
// own surface, anyone signed out to login. Business is Gabe's back
// office and never opens to another role.
export async function requireOwner(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role !== "owner") {
    redirect(surfaceForRole(profile.role));
  }
  return { userId: session.userId, email: session.email, profile };
}
