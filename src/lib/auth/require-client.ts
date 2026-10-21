import { redirect } from "next/navigation";
import { getSessionProfile, surfaceForRole, type Profile } from "./get-profile";

// Guards the client shell. Only a client passes; every other role is sent to
// its own surface; anyone without a session or profile goes back to login.
export async function requireClient(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role !== "client") redirect(surfaceForRole(profile.role));

  return { userId: session.userId, email: session.email, profile };
}
