import { redirect } from "next/navigation";
import { getSessionProfile, type Profile } from "./get-profile";

// Guards the client shell. A client passes; owner and coach are sent to the
// coach shell; anyone without a session or profile goes back to login.
export async function requireClient(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role === "owner" || profile.role === "coach") redirect("/program");

  return { userId: session.userId, email: session.email, profile };
}
