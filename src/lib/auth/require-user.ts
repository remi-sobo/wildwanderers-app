import { redirect } from "next/navigation";
import { getSessionProfile, type Profile } from "./get-profile";

// Guards any signed-in surface. Returns the profile; redirects to login when
// there is no session or profile. Role checks live in the role-group layouts.
export async function requireUser(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session || !session.profile) redirect("/login");
  return { userId: session.userId, email: session.email, profile: session.profile };
}
