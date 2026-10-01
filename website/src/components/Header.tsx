"use client";

import { useEffect, useState } from "react";
import { IconClose, IconMenu, SocialIcon } from "./icons";
import type { Social } from "@/lib/project";

const NAV = [
  { href: "/#story", label: "Story" },
  { href: "/#utility", label: "Utility" },
  { href: "/#tokenomics", label: "Tokenomics" },
  { href: "/transparency", label: "Transparency" },
  { href: "/#buy", label: "How to buy" },
  { href: "/receipts", label: "Receipts" },
];

export function Header({
  name,
  cashtag,
  logo,
  socials,
  cta,
}: {
  name: string;
  cashtag: string;
  logo: string;
  socials: Social[];
  cta: { href: string; label: string; external: boolean };
}) {
  const [open, setOpen] = useState(false);
  const live = socials.filter((s) => s.href);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-paper/10 bg-counter/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label={`${name} home`}>
          <span className="inline-flex size-9" dangerouslySetInnerHTML={{ __html: logo }} />
          <span className="font-display text-[22px] leading-none font-black tracking-[0.04em]">{name}</span>
          <span className="hidden text-[11px] font-bold tracking-[0.2em] text-fog sm:inline">{cashtag}</span>
        </a>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="px-2.5 py-2 text-[11px] font-semibold tracking-[0.16em] text-fog uppercase hover:text-paper">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          {live.map((s) => (
            <a key={s.key} href={s.href!} target="_blank" rel="noopener noreferrer" className="p-2 text-fog hover:text-paper" aria-label={s.label}>
              <SocialIcon k={s.key} className="size-[18px]" />
            </a>
          ))}
          <a
            href={cta.href}
            {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="ml-2 hidden bg-paper px-3.5 py-2 text-[11px] font-bold tracking-[0.16em] text-ink uppercase hover:bg-marker sm:inline-block"
          >
            {cta.label}
          </a>
          <button
            type="button"
            className="ml-1 p-2 text-paper lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose className="size-6" /> : <IconMenu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="paper edge-bottom fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto pb-10 lg:hidden" aria-label="Mobile">
          <ul className="mx-auto max-w-[640px] px-5 pt-4">
            {NAV.map((n, i) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline border-b-2 border-dotted border-ink/20 py-4 text-sm font-bold tracking-[0.12em] uppercase"
                >
                  <span className="mr-4 font-display text-lg font-black">{String(i + 1).padStart(2, "0")}</span>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-6 flex max-w-[640px] flex-wrap gap-3 px-5">
            <a
              href={cta.href}
              {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="btn-hard bg-ink px-4 py-3 text-xs font-bold tracking-[0.16em] text-paper uppercase"
            >
              {cta.label}
            </a>
            {live.map((s) => (
              <a key={s.key} href={s.href!} target="_blank" rel="noopener noreferrer" className="border-2 border-ink p-3" aria-label={s.label}>
                <SocialIcon k={s.key} className="size-5" />
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
