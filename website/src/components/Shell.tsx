import type { ReactNode } from "react";
import { symbol } from "../../../brand/mascot.mjs";
import { ca, cashtag, formatUtc, project, socials, tradeUrl } from "@/lib/project";
import { Header } from "./Header";
import { Reveal } from "./Reveal";
import { SocialIcon } from "./icons";

export const BUILT_AT = new Date().toISOString();

export function primaryCta() {
  if (project.links.telegram) return { href: project.links.telegram, label: "Join community", external: true };
  if (project.links.x) return { href: project.links.x, label: "Join community", external: true };
  return { href: "/history", label: "Read the build log", external: false };
}

export function Shell({ children }: { children: ReactNode }) {
  const logo = symbol({ bg: "#f4f0e6" }).replace("<svg ", '<svg width="36" height="36" aria-hidden="true" ');
  return (
    <>
      <a href="#main" className="sr-only z-50 bg-marker px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Header name={project.name} cashtag={cashtag} logo={logo} socials={socials} cta={primaryCta()} />
      <main id="main">{children}</main>
      <Footer />
      <Reveal />
    </>
  );
}

function Footer() {
  const official = [
    { label: "Website", href: project.links.website },
    { label: "X", href: project.links.x },
    { label: "Telegram", href: project.links.telegram },
    { label: "Telegram chat", href: project.links.telegramChat },
    { label: "GitHub", href: project.links.github },
    { label: "Pump.fun", href: tradeUrl },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <footer className="border-t border-paper/10 pt-14 pb-10 text-fog">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="font-display text-4xl font-black text-paper">{project.name}</div>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed">
            {cashtag} is a meme coin with no intrinsic value and no expectation of financial return. Nothing here is financial
            advice. Crypto is risky — only use money you can afford to lose. Not available where prohibited.
          </p>
          <div className="mt-5 flex gap-2">
            {socials
              .filter((s) => s.href)
              .map((s) => (
                <a key={s.key} href={s.href!} target="_blank" rel="noopener noreferrer" className="border border-paper/20 p-2.5 hover:text-paper" aria-label={s.label}>
                  <SocialIcon k={s.key} className="size-4" />
                </a>
              ))}
          </div>
        </div>
        <div>
          <h3 className="text-[11px] font-bold tracking-[0.25em] text-paper uppercase">Official links</h3>
          <ul className="mt-4 space-y-2 text-[13px]">
            {official.map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-paper">
                  {l.label} <span className="text-fog/60">— {l.href.replace(/^https?:\/\//, "")}</span>
                </a>
              </li>
            ))}
            <li className="pt-2 text-[12px] leading-relaxed text-fog/80">
              Contract: {ca ? <code className="break-all text-paper">{ca}</code> : <span className="text-stamp">not launched yet</span>}
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-[11px] font-bold tracking-[0.25em] text-paper uppercase">Pages</h3>
          <ul className="mt-4 space-y-2 text-[13px]">
            <li><a href="/" className="hover:text-paper">Home</a></li>
            <li><a href="/history" className="hover:text-paper">Build log</a></li>
            <li><a href="/transparency" className="hover:text-paper">Transparency</a></li>
            <li><a href="/kit" className="hover:text-paper">Meme kit</a></li>
          </ul>
          <p className="mt-6 text-[11px] tracking-[0.12em] uppercase">
            We never DM first.
            <br />
            We never ask for your seed phrase.
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1280px] flex-wrap justify-between gap-3 px-4 text-[11px] tracking-[0.14em] text-fog/70 uppercase sm:px-6">
        <span>© 2026 {project.name} · built in public</span>
        <span>Page printed {formatUtc(BUILT_AT, true)}</span>
      </div>
    </footer>
  );
}
