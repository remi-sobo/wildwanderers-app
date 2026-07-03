import { redirect } from "next/navigation";
import { getSessionProfile, type Profile } from "./get-profile";

// Guards the Business switch. Only the owner passes; a coach is sent to Program,
// a client to their home, anyone signed out to login. Business is Gabe's back
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
    redirect(profile.role === "coach" ? "/program" : "/home");
  }
  return { userId: session.userId, email: session.email, profile };
}
