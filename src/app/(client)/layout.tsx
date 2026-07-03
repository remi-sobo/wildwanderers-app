import { requireClient } from "@/lib/auth/require-client";
import { BottomNav } from "@/components/shell/BottomNav";

export const dynamic = "force-dynamic";

// The client shell. Mobile-first, bone canvas, roomy and thumb-friendly, with
// the bottom tab bar. Owner and coach are bounced to the coach shell.
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireClient();

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-lg px-5 pb-28 pt-6">{children}</div>
      <BottomNav />
    </div>
  );
}
