import type { Metadata } from "next";
import { SectionHead } from "@/components/receipt";
import { Shell } from "@/components/Shell";
import { IconDownload } from "@/components/icons";
import { cashtag, project } from "@/lib/project";

export const metadata: Metadata = {
  title: "Meme kit",
  description: `${project.mascot} in every mood, villains, logo and colors. Free for ${cashtag} memes and fan art.`,
  alternates: { canonical: "/kit" },
};

const POSES = [
  ["skeptic", "Receipt?"],
  ["neutral", "Deadpan"],
  ["happy", "Verified"],
  ["shock", "You bought WHAT?"],
  ["stamp", "VOID"],
  ["magnifier", "Checking the CA"],
  ["wave", "gm"],
  ["sleep", "Printing since 03:14"],
] as const;

const COLORS = [
  ["Thermal paper", "#F4F0E6", "bg-paper text-ink"],
  ["Thermal ink", "#1B1A17", "bg-ink text-paper"],
  ["Stamp red", "#D8332A", "bg-stamp text-paper"],
  ["Highlighter", "#F6E05E", "bg-marker text-ink"],
  ["Counter", "#141311", "bg-counter text-paper border border-paper/20"],
  ["Faded ink", "#6B665C", "bg-faded text-paper"],
] as const;

function Download({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} download className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] uppercase underline underline-offset-4 hover:bg-marker">
      <IconDownload className="size-3.5" /> {label}
    </a>
  );
}

export default function Kit() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-6 sm:pt-14">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-fog uppercase">{cashtag} · meme kit</p>
        <h1 className="mt-3 max-w-[18ch] text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-paper [font-stretch:112.5%]">
          Make your own receipts.
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-paper/80">
          {project.mascot} in every mood, the villains, the logo and the colors. Transparent PNGs, free to use for memes and fan art. One rule:
          don&apos;t use them to pretend to be an official account.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-[1100px] px-2 pb-20 sm:px-4">
        <article className="paper edge-both px-5 pt-12 pb-16 shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:px-12">
          <section aria-labelledby="moods">
            <SectionHead n="01" id="moods" title={`${project.mascot}, every mood`} kicker="PNG · 800×1200 · transparent" />
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {POSES.map(([key, caption]) => (
                <li key={key} className="reveal flex flex-col border-2 border-ink/80 bg-paper-back/40 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/kit/chek-${key}.png`} alt={`${project.mascot}: ${caption}`} width={800} height={1200} loading="lazy" className="h-auto w-full" />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold">{caption}</span>
                    <Download href={`/kit/chek-${key}.png`} label="PNG" />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="pt-16" aria-labelledby="villains">
            <SectionHead n="02" id="villains" title="The villains" kicker="Lore" />
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                ["shredder", "The Shredder", "Eats evidence: deleted posts, wiped sites, vanished devs."],
                ["coupon", "The Coupon", "Loud, shiny, always expiring. “100X OFF! TODAY ONLY!”"],
              ].map(([key, name, line]) => (
                <li key={key} className="reveal grid grid-cols-[120px_1fr] items-center gap-4 border-2 border-ink/80 p-3 sm:grid-cols-[150px_1fr]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/kit/villain-${key}.png`} alt={name} width={800} height={1200} loading="lazy" className="h-auto w-full" />
                  <div>
                    <h3 className="text-lg font-extrabold">{name}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed">{line}</p>
                    <div className="mt-3">
                      <Download href={`/kit/villain-${key}.png`} label="PNG" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="pt-16" aria-labelledby="logo">
            <SectionHead n="03" id="logo" title="Logo" kicker="Mark + wordmark" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="reveal flex flex-col items-center gap-3 border-2 border-ink/80 p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kit/logo-mark-1024.png" alt="Logo mark" width={1024} height={1024} loading="lazy" className="size-28" />
                <div className="flex gap-4">
                  <Download href="/kit/logo-mark.svg" label="SVG" />
                  <Download href="/kit/logo-mark-1024.png" label="PNG" />
                </div>
              </div>
              <div className="reveal flex flex-col items-center justify-between gap-3 border-2 border-ink/80 p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kit/wordmark-ink.png" alt="Wordmark, ink" width={1200} height={400} loading="lazy" className="mt-6 h-auto w-full" />
                <Download href="/kit/wordmark-ink.png" label="PNG · ink" />
              </div>
              <div className="reveal flex flex-col items-center justify-between gap-3 bg-ink p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kit/wordmark-paper.png" alt="Wordmark, paper" width={1200} height={400} loading="lazy" className="mt-6 h-auto w-full" />
                <a href="/kit/wordmark-paper.png" download className="text-[11px] font-bold tracking-[0.14em] text-paper uppercase underline underline-offset-4">
                  PNG · paper
                </a>
              </div>
            </div>
          </section>

          <section className="pt-16" aria-labelledby="colors">
            <SectionHead n="04" id="colors" title="Colors & type" kicker="Brand" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COLORS.map(([name, hex, cls]) => (
                <li key={hex} className={`reveal flex h-24 flex-col justify-end p-3 ${cls}`}>
                  <span className="text-[12px] font-bold">{name}</span>
                  <code className="text-[12px]">{hex}</code>
                </li>
              ))}
            </ul>
            <div className="reveal mt-6 grid gap-4 sm:grid-cols-2">
              <div className="border-2 border-ink/80 p-4">
                <div className="font-display text-4xl font-black">Doto</div>
                <p className="mt-1 text-[12px] text-faded">Display — dot-matrix, like a receipt printer. SIL OFL.</p>
              </div>
              <div className="border-2 border-ink/80 p-4">
                <div className="text-2xl font-extrabold [font-stretch:112.5%]">Martian Mono</div>
                <p className="mt-1 text-[12px] text-faded">Text — wide mono for headlines, condensed for body. SIL OFL.</p>
              </div>
            </div>
          </section>

          <section className="pt-16" aria-labelledby="rules">
            <SectionHead n="05" id="rules" title="Meme rules" kicker="Short" />
            <ul className="reveal space-y-2 text-[14px] leading-relaxed">
              <li>→ Use it, remix it, put {project.mascot} in any situation. Credit is nice, not required.</li>
              <li>→ Don&apos;t make accounts that pretend to be official, and don&apos;t use it to promote other tokens.</li>
              <li>→ No price promises in our name. {project.mascot} would stamp them VOID anyway.</li>
            </ul>
            <a href="/" className="mt-10 inline-block text-[12px] font-bold tracking-[0.16em] uppercase underline underline-offset-4">
              ← Back to the receipt
            </a>
          </section>
        </article>
      </div>
    </Shell>
  );
}
