import { redirect } from "next/navigation";
import { getSessionProfile, type Profile } from "./get-profile";

// Guards the coach shell. Owner and coach pass; a client is sent to their home;
// anyone without a session or profile goes back to login.
export async function requireOwnerOrCoach(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role !== "owner" && profile.role !== "coach") redirect("/home");

  return { userId: session.userId, email: session.email, profile };
}
