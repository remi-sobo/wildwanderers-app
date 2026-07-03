import { requireClient } from "@/lib/auth/require-client";

// Guard only, plus a comfortable reading column for the client surface. The
// shell chrome comes from the parent (app) layout. A client passes; owner and
// coach are redirected to the coach surface.
export default async function ClientGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireClient();
  return <div className="mx-auto w-full max-w-2xl">{children}</div>;
}
