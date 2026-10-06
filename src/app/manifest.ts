import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nisafety Hub | Public Safety Records",
    short_name: "Nisafety Hub",
    description: "A public directory for accessible safety records and documents.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#102a33",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
