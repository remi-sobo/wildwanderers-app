import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="eyebrow text-bark">Off the map</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[36px] leading-tight text-forest-deep">
        This trail does not exist.
      </h1>
      <p className="mt-3 max-w-sm text-[14.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
        The page you were looking for is not here. Let us get you back on solid
        ground.
      </p>
      <Link
        href="/"
        className="ww-link mt-6 text-sm font-semibold text-forest"
      >
        Back to Wild Wanderers
      </Link>
    </main>
  );
}
