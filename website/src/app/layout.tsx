import type { Metadata, Viewport } from "next";
import { doto, martian } from "./fonts";
import { cashtag, project, siteUrl } from "@/lib/project";
import "./globals.css";

const title = `${project.name} (${cashtag}) — ${project.tagline}`;
const description = `${cashtag} is a Solana meme coin with one rule: every claim comes with a receipt. No promises, no fake partners — memes, lore and proof.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: `%s · ${project.name} (${cashtag})` },
  description,
  applicationName: project.name,
  openGraph: {
    type: "website",
    siteName: `${project.name} (${cashtag})`,
    title,
    description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title, description },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#141311",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${doto.variable} ${martian.variable}`}>
      <body className="grain min-h-dvh antialiased">{children}</body>
    </html>
  );
}
