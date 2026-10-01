import type { MetadataRoute } from "next";
import { cashtag, project } from "@/lib/project";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${project.name} (${cashtag})`,
    short_name: project.name,
    description: project.oneLiner,
    start_url: "/",
    display: "standalone",
    background_color: "#141311",
    theme_color: "#141311",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
