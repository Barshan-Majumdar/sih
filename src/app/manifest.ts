import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agira - Construction Operations",
    short_name: "Agira",
    description:
      "Agira runs the schedule, the field, and the project documents as one loop, where every AI change is cited, reviewed, and reversible.",
    // Installed app opens straight into the app, not the marketing landing page.
    start_url: "/projects",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#101720",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
