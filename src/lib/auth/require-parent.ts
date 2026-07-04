import { redirect } from "next/navigation";
import { getSessionProfile, type Profile } from "./get-profile";

// Guards the family view. Only a parent passes; staff go to their program,
// a client to their home, anyone signed out to login.
export async function requireParent(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");

  const { profile } = session;
  if (profile.role !== "parent") {
    redirect(profile.role === "owner" || profile.role === "coach" ? "/program" : "/home");
  }
  return { userId: session.userId, email: session.email, profile };
}
