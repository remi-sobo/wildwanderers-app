import withPWAInit from "@ducanh2912/next-pwa";

// Service worker for the installable app (the next-pwa line in the stack,
// via the maintained @ducanh2912 fork). Generated into public/ at build
// time and gitignored; disabled in dev so it never caches a dev server.
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
