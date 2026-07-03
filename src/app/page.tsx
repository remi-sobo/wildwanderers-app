import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Ring 0 placeholder landing. It exists so sign-in round-trips end to end and
// can be verified. The coach and client shells with role routing replace this
// in a later Ring 0 commit.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="eyebrow text-bark">Wild Wanderers Fitness</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[30px] leading-tight text-forest-deep">
        You are signed in.
      </h1>
      <p className="mt-3 max-w-sm text-[14.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
        Your workspace is on its way. The coach and client surfaces arrive with
        the next Ring 0 commit.
      </p>
      <p className="mt-2 text-[13px] text-[color:var(--color-text-faint)]">
        {user.email}
      </p>

      <form action="/auth/signout" method="post" className="mt-8">
        <button type="submit" className="submit max-w-[220px]">
          <span className="submit-label">Sign out</span>
        </button>
      </form>
    </main>
  );
}
