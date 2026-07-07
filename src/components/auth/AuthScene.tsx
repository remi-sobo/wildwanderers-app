// The cinematic left panel shared by every auth screen: the golden-hour trail
// hero with two forest scrims tuned so the left-aligned wordmark and caption
// stay legible while the luminous center of the scene reads through.
const scrimVertical =
  "linear-gradient(180deg, rgba(16,26,18,.58) 0%, rgba(16,26,18,.12) 22%, rgba(16,26,18,0) 46%, rgba(12,20,14,.36) 72%, rgba(10,17,12,.8) 100%)";
const scrimLeft =
  "linear-gradient(90deg, rgba(14,22,15,.55) 0%, rgba(14,22,15,.16) 32%, rgba(14,22,15,0) 62%)";

export function AuthScene() {
  return (
    <section className="relative h-[200px] overflow-hidden bg-forest-deep md:h-auto">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-forest-deep bg-cover bg-center"
        style={{
          backgroundImage:
            'image-set(url("/login-scene.avif") type("image/avif"), url("/login-scene.webp") type("image/webp"))',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: scrimVertical }} />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: scrimLeft }} />

      {/* The full lockup in bone opens the door, at the same optical weight
          the text wordmark held. The scrims above keep it legible. */}
      <div className="absolute left-8 top-8 z-10 md:left-[52px] md:top-11">
        <img
          src="/brand/full-bone.png"
          alt="Wild Wanderers"
          width={165}
          height={40}
          className="h-8 w-auto md:h-10"
          style={{ filter: "drop-shadow(0 1px 14px rgba(8,14,9,.45))" }}
        />
        <p className="eyebrow mt-2 text-[10.5px] tracking-[0.28em] text-bone/85">
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
  );
}
