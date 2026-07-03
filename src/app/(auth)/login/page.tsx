import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Wild Wanderers",
};

// Two forest scrims tuned for the bright golden-hour hero. The vertical pass
// darkens the top (wordmark) and bottom (caption); the left pass anchors the
// left-aligned text so it stays legible while the luminous center and right of
// the scene read through.
const scrimVertical =
  "linear-gradient(180deg, rgba(16,26,18,.58) 0%, rgba(16,26,18,.12) 22%, rgba(16,26,18,0) 46%, rgba(12,20,14,.36) 72%, rgba(10,17,12,.8) 100%)";
const scrimLeft =
  "linear-gradient(90deg, rgba(14,22,15,.55) 0%, rgba(14,22,15,.16) 32%, rgba(14,22,15,0) 62%)";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col md:grid md:grid-cols-[57fr_43fr]">
      {/* Cinematic panel. A short band on mobile, the full column on desktop. */}
      <section className="relative h-[200px] overflow-hidden bg-forest-deep md:h-auto">
        {/* Golden-hour trail hero. AVIF with a WebP fallback; forest-deep shows
            underneath until the image paints. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-forest-deep bg-cover bg-center"
          style={{
            backgroundImage:
              'image-set(url("/login-scene.avif") type("image/avif"), url("/login-scene.webp") type("image/webp"))',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: scrimVertical }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: scrimLeft }}
        />

        <div className="absolute left-8 top-8 z-10 md:left-[52px] md:top-11">
          <p
            className="font-[family-name:var(--font-display)] text-[22px] font-medium leading-none text-bone md:text-[26px]"
            style={{ textShadow: "0 1px 22px rgba(8,14,9,.6)" }}
          >
            Wild Wanderers
          </p>
          <p className="eyebrow mt-1.5 text-[10.5px] tracking-[0.28em] text-bone/85">
            Fitness
          </p>
        </div>

        <div className="absolute bottom-11 left-[52px] z-10 hidden max-w-[460px] md:block">
          <h2
            className="font-[family-name:var(--font-display)] text-[44px] font-light leading-[1.05] tracking-[-0.015em] text-bone"
            style={{ textShadow: "0 2px 34px rgba(8,14,9,.62)" }}
          >
            Good to have you
            <br />
            <em
              className="italic text-cream"
              style={{ textShadow: "0 2px 30px rgba(8,14,9,.5)" }}
            >
              back on the trail.
            </em>
          </h2>
          <p
            className="mt-4 max-w-[400px] text-sm leading-[1.55] text-bone/95"
            style={{ textShadow: "0 1px 18px rgba(8,14,9,.55)" }}
          >
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
