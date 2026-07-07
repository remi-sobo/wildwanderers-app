import type { MetadataRoute } from "next";

// The installable app: bone canvas, forest-deep chrome, the mark on the
// home screen. Scoped to this deployment, which is Wild Wanderers Fitness.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wild Wanderers",
    short_name: "Wanderers",
    description: "The coaching platform for Wild Wanderers Fitness.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F1E7",
    theme_color: "#1E331F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
