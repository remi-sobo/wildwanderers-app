import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reset password — Wild Wanderers",
};

// Placeholder. The full password reset flow (request, email, and set a new one)
// lands with the rest of the auth routes in a later Ring 0 commit. Kept as a
// real page so the "Forgot password?" link is never a dead end.
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="eyebrow text-bark">Password reset</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[30px] leading-tight text-forest-deep">
        Coming with the next update.
      </h1>
      <p className="mt-3 max-w-sm text-[14.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
        Resetting your password from here is almost ready. For now, reach out to
        Gabe and he will get you back in.
      </p>
      <Link
        href="/login"
        className="ww-link mt-6 text-sm font-semibold text-forest"
      >
        Back to sign in
      </Link>
    </main>
  );
}
