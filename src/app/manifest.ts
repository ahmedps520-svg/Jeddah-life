import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "JEDDAH LIFE",
    short_name: "Jeddah Life",
    description: "Discover your city differently — places, outings, events and plans for Jeddah, in English and Arabic.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9f5ee",
    theme_color: "#0b1b2b",
    categories: ["travel", "lifestyle", "navigation"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Map", short_name: "Map", url: "/map", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Plan an outing", short_name: "Plan", url: "/plan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Saved", short_name: "Saved", url: "/saved", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
