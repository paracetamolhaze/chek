import type { Metadata } from "next";
import { ReceiptMaker } from "@/components/ReceiptMaker";
import { Shell } from "@/components/Shell";
import { project, siteUrl } from "@/lib/project";
import { claimQuery } from "../../../../shared/claim.mjs";

// The public Receipt Generator. Useful to anyone: type a claim, get a receipt image to share.
// Host and X handle for the images come from config/project.json (links.website, links.x).
const host = (() => {
  try {
    return new URL(siteUrl).host;
  } catch {
    return "";
  }
})();
const handle = (() => {
  const x = project.links.x ?? "";
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})/i.exec(x) ?? /^@?([A-Za-z0-9_]{1,15})$/.exec(x);
  return m ? `@${m[1]}` : "@chekcoinsol";
})();

const title = `Print a receipt · ${project.name}`;
const description = "Write a claim. Get a receipt. Share it.";
const image = { url: `/api/image?${claimQuery({ claim: "Trust me bro" }, { short: false })}&format=wide`, width: 1200, height: 630, alt: "A receipt for the claim “Trust me bro”: proof none provided, status unverified." };

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/print" },
  openGraph: { type: "website", siteName: project.name, title, description, url: "/print", images: [image] },
  twitter: { card: "summary_large_image", site: handle, title, description, images: [image] },
};

export default function PrintPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-6 sm:pt-14">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-fog uppercase">{project.name} · receipt printer</p>
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-paper [font-stretch:112.5%]">
          Print a receipt.
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-paper/80">{description}</p>
      </div>
      <div className="mx-auto mt-10 max-w-[1280px] px-4 pb-20 sm:px-6">
        <ReceiptMaker site={siteUrl.replace(/\/+$/, "")} host={host} handle={handle} />
      </div>
    </Shell>
  );
}
