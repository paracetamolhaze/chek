import type { ReactNode } from "react";

// Building blocks of the receipt language: section heads, itemized rows, stamps, tags.

export function SectionHead({ n, title, kicker, id }: { n: string; title: string; kicker?: string; id?: string }) {
  return (
    <header className="reveal mb-8 sm:mb-10">
      <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.25em] text-faded uppercase">
        <span className="font-display text-base font-black tracking-normal text-ink">{n}</span>
        <span className="rule-dash flex-1 text-ink" />
        {kicker && <span>{kicker}</span>}
      </div>
      <h2 id={id} className="mt-4 text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.05] font-extrabold tracking-[-0.02em] [font-stretch:112.5%]">
        {title}
      </h2>
    </header>
  );
}

export function Row({
  label,
  value,
  strong,
  muted,
  mono = true,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`flex items-baseline py-1.5 text-[13px] sm:text-sm ${strong ? "font-bold" : ""} ${muted ? "text-faded" : ""}`}>
      <span className="shrink-0 uppercase tracking-[0.06em]">{label}</span>
      <span className="leader" aria-hidden />
      <span className={`min-w-0 text-right uppercase ${mono ? "tracking-[0.04em]" : ""} break-all`}>{value}</span>
    </div>
  );
}

export function Stamp({
  children,
  rotate = -6,
  className = "",
  dark = false,
}: {
  children: ReactNode;
  rotate?: number;
  className?: string;
  dark?: boolean;
}) {
  return (
    <span className={`stamp ${dark ? "stamp-dark" : ""} ${className}`} style={{ ["--r" as string]: `${rotate}deg` }}>
      {children}
    </span>
  );
}

const TAGS = {
  live: "bg-ink text-paper",
  done: "bg-ink text-paper",
  now: "bg-marker text-ink",
  planned: "border-2 border-ink text-ink",
  next: "border-2 border-ink text-ink",
  later: "border-2 border-dashed border-faded text-faded",
} as const;

export type TagKind = keyof typeof TAGS;

export function Tag({ kind, children }: { kind: TagKind; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-[3px] text-[10px] leading-none font-bold tracking-[0.18em] uppercase ${TAGS[kind]}`}>
      {children ?? kind}
    </span>
  );
}

export function Stars({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`text-center text-xs tracking-[0.6em] text-faded select-none ${className}`}>
      * * * * * * * *
    </div>
  );
}
