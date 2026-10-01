import { Row, Stamp } from "./receipt";

// Drop-in call to action for the Receipt Generator (/print). Server component, no JavaScript.
// Usage: <PrintCta /> anywhere on a dark (counter) section; pass className for spacing.
export function PrintCta({ className = "" }: { className?: string }) {
  return (
    <a
      href="/print"
      className={`group paper edge-bottom relative block max-w-[460px] px-5 pt-6 pb-9 text-ink shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] transition-transform hover:-translate-y-0.5 sm:px-7 ${className}`}
    >
      <p className="text-[10px] font-bold tracking-[0.25em] text-faded uppercase">Receipt printer · free</p>
      <p className="mt-2 text-[clamp(1.5rem,3.5vw,2rem)] leading-[1.05] font-extrabold tracking-[-0.02em] [font-stretch:112.5%]">Print a receipt.</p>
      <p className="mt-2 text-[13px] leading-relaxed">Write a claim. Get a receipt. Share it.</p>
      <div className="rule-dash mt-4 text-ink" />
      <div className="mt-2">
        <Row label="Claim" value="yours" />
        <Row label="Proof" value="none provided" />
        <Row label="Status" value={<span className="text-stamp">unverified</span>} strong />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 bg-ink px-3.5 py-2.5 text-[11px] font-bold tracking-[0.16em] text-paper uppercase group-hover:bg-stamp">
          Print one →
        </span>
        <Stamp rotate={-8} className="text-[12px]">
          Unverified
        </Stamp>
      </div>
    </a>
  );
}
