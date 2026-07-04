import { requireClient } from "@/lib/auth/require-client";
import { ReportIssueFab } from "@/components/report/ReportIssueFab";

// Guard only, plus a comfortable reading column for the client surface. The
// shell chrome comes from the parent (app) layout. A client passes; owner and
// coach are redirected to the coach surface. The report FAB mirrors the coach
// shell's "Report an issue" entry so a client can flag a bug, confusion, or
// idea from their own surface.
export default async function ClientGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireClient();
  return (
    <div className="mx-auto w-full max-w-2xl">
      {children}
      <ReportIssueFab />
    </div>
  );
}
