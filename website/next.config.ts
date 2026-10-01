import path from "node:path";
import type { NextConfig } from "next";

// Static export: the public site is plain HTML/CSS/JS with no server and no write endpoints.
// The repo root is the Turbopack root so the site can read ../config, ../content and ../brand.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
