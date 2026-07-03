import { AuthScene } from "@/components/auth/AuthScene";

// The two-column auth shell: the cinematic scene on the left, the form on the
// right over bone. Shared by login, forgot-password, and reset-password. On
// mobile it stacks, a short photo band above the form.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col md:grid md:grid-cols-[57fr_43fr]">
      <AuthScene />
      <section className="relative flex flex-1 flex-col items-center justify-center bg-canvas px-6 py-12 md:px-12">
        {children}
        <p className="eyebrow absolute bottom-8 text-[10px] tracking-[0.22em] text-[color:var(--color-text-faint)]">
          A SOBO build
        </p>
      </section>
    </main>
  );
}
