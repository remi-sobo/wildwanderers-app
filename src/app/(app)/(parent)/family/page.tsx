import { getMyFamily } from "@/lib/data/family";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyOrg } from "@/lib/data/org";
import { FamilyView } from "@/components/family/FamilyView";

export default async function FamilyPage() {
  const [children, session, org] = await Promise.all([getMyFamily(), getSessionProfile(), getMyOrg()]);
  return (
    <FamilyView
      children={children}
      firstName={session?.profile?.first_name?.trim() || undefined}
      orgName={org?.name}
    />
  );
}
