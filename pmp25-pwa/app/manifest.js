export default function manifest() {
  return {
    name: "PMP2.5 Exposure Tracker",
    short_name: "PMP2.5",
    description: "Track PM2.5 exposure, routes, records, summaries, and profile settings.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "fullscreen"],
    background_color: "#050910",
    theme_color: "#00d2ff",
    orientation: "portrait",
    categories: ["health", "navigation", "weather", "utilities"],
    lang: "en",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
