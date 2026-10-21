import { requireAdvisor } from "@/lib/auth/require-advisor";

// Guards the advisor workspace. Only an advisor passes; the shell chrome
// comes from the parent (app) layout.
export default async function AdvisorGuardLayout({ children }: { children: React.ReactNode }) {
  await requireAdvisor();
  return <div className="mx-auto w-full max-w-5xl">{children}</div>;
}
