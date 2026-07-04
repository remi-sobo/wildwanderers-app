import { getMyFamily } from "@/lib/data/family";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { FamilyView } from "@/components/family/FamilyView";

export default async function FamilyPage() {
  const [children, session] = await Promise.all([getMyFamily(), getSessionProfile()]);
  return <FamilyView children={children} firstName={session?.profile?.first_name?.trim() || undefined} />;
}
