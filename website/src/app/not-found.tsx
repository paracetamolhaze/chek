import { Mascot } from "@/components/Mascot";
import { Stamp } from "@/components/receipt";
import { Shell } from "@/components/Shell";
import { cashtag } from "@/lib/project";

export default function NotFound() {
  return (
    <Shell>
      <div className="mx-auto grid max-w-[900px] items-center gap-8 px-4 py-16 sm:grid-cols-[1fr_220px] sm:py-24">
        <div className="paper edge-both relative px-6 py-12 sm:px-10">
          <Stamp rotate={-8} className="absolute top-6 right-6 text-2xl">Void</Stamp>
          <p className="text-[11px] font-semibold tracking-[0.28em] text-faded uppercase">Error 404</p>
          <h1 className="mt-3 text-4xl leading-none font-extrabold tracking-[-0.02em] [font-stretch:112.5%] sm:text-5xl">No receipt for this page.</h1>
          <p className="mt-5 max-w-[42ch] text-[14px] leading-relaxed">
            It doesn&apos;t exist. And if someone DMed you a link to {cashtag} — we never DM first.
          </p>
          <a href="/" className="btn-hard mt-8 inline-block bg-ink px-5 py-3 text-[12px] font-bold tracking-[0.16em] text-paper uppercase">
            Back to the receipt
          </a>
        </div>
        <Mascot expr="shock" pose="up" dark className="mx-auto h-auto w-[180px]" />
      </div>
    </Shell>
  );
}
