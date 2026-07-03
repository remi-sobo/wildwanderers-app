import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Wild Wanderers",
};

// Forest scrim over the hero, top and bottom, so the wordmark and caption stay
// legible over any part of the photo.
const scrim =
  "linear-gradient(180deg, rgba(18,28,20,.42) 0%, rgba(18,28,20,0) 26%, rgba(18,28,20,0) 46%, rgba(14,22,15,.62) 100%)";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col md:grid md:grid-cols-[57fr_43fr]">
      {/* Cinematic panel. A short band on mobile, the full column on desktop. */}
      <section className="relative h-[200px] overflow-hidden bg-forest-deep md:h-auto">
        {/* Photo. Supplied at public/login-scene.jpg; forest-deep shows until it lands. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-forest-deep bg-cover bg-center"
          style={{ backgroundImage: "url(/login-scene.jpg)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: scrim }}
        />

        <div className="absolute left-8 top-8 z-10 md:left-[52px] md:top-11">
          <p className="font-[family-name:var(--font-display)] text-[22px] font-medium leading-none text-bone md:text-[26px]">
            Wild Wanderers
          </p>
          <p className="eyebrow mt-1.5 text-[10.5px] tracking-[0.28em] text-bone/80">
            Fitness
          </p>
        </div>

        <div className="absolute bottom-11 left-[52px] z-10 hidden max-w-[460px] md:block">
          <h2
            className="font-[family-name:var(--font-display)] text-[44px] font-light leading-[1.05] tracking-[-0.015em] text-bone"
            style={{ textShadow: "0 2px 30px rgba(8,14,9,.4)" }}
          >
            Good to have you
            <br />
            <em className="italic text-cream">back on the trail.</em>
          </h2>
          <p className="mt-4 max-w-[400px] text-sm leading-[1.55] text-bone/90">
            Your plan, your progress, and your next session with Gabe, all in one
            place.
          </p>
        </div>
      </section>

      {/* Sign-in form on bone. */}
      <section className="relative flex flex-1 flex-col items-center justify-center bg-canvas px-6 py-12 md:px-12">
        <LoginForm />
        <p className="eyebrow absolute bottom-8 text-[10px] tracking-[0.22em] text-[color:var(--color-text-faint)]">
          A SOBO build
        </p>
      </section>
    </main>
  );
}
