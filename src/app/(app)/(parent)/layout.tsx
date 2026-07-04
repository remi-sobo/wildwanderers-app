import { requireParent } from "@/lib/auth/require-parent";

// Guards the family view. Only a parent passes; the shell chrome comes from the
// parent (app) layout.
export default async function ParentGuardLayout({ children }: { children: React.ReactNode }) {
  await requireParent();
  return <>{children}</>;
}
