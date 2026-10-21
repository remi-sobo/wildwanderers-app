import { redirect } from "next/navigation";
import { getSessionProfile, surfaceForRole } from "@/lib/auth/get-profile";

export const dynamic = "force-dynamic";

// Where a signed-in account with no usable role lands, instead of falling
// through to someone else's surface. Anyone with a real role is sent on.
export default async function NoAccessPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const target = surfaceForRole(session.profile?.role);
  if (target !== "/no-access") redirect(target);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="eyebrow text-bark">Wild Wanderers</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[24px] leading-tight text-forest-deep">
          This account is not set up yet.
        </h1>
        <p className="mt-2 text-[14px] text-[color:var(--color-text-muted)]">
          Ask the person who invited you to finish setting it up, then sign in again.
        </p>
        <form action="/auth/signout" method="post" className="mt-5">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--border-strong)] px-5 text-[14px] font-semibold text-forest-deep"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
