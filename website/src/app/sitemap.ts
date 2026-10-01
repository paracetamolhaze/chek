import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/project";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/history", "/transparency", "/kit"].map((p) => ({ url: `${siteUrl}${p}` }));
}
