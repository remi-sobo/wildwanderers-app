import { redirect } from "next/navigation";
import { getSessionProfile, surfaceForRole, type Profile } from "./get-profile";

// Guards the coach shell. Owner and coach pass; anyone else goes to their own surface;
// anyone without a session or profile goes back to login.
export async function requireOwnerOrCoach(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role !== "owner" && profile.role !== "coach") redirect(surfaceForRole(profile.role));

  return { userId: session.userId, email: session.email, profile };
}
