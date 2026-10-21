import { redirect } from "next/navigation";
import { getSessionProfile, surfaceForRole, type Profile } from "./get-profile";

// Guards the family view. Only a parent passes; everyone else goes to their
// own surface, anyone signed out to login.
export async function requireParent(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role !== "parent") {
    redirect(surfaceForRole(profile.role));
  }
  return { userId: session.userId, email: session.email, profile };
}
