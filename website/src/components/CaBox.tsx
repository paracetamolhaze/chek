"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconCopy } from "./icons";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Contract address strip. Before launch it shows a stamp, never a placeholder that looks like an address.
// At the launch minute the static page may still be the pre-launch build for a minute or two: it asks the API, which
// switches only after the server verified the mint on-chain (creator wallet, ticker, authorities), and shows the CA at once.
export function CaBox({ ca: staticCa, note, tone = "dark" }: { ca: string | null; note: string; tone?: "dark" | "paper" }) {
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState<{ ca: string; verifiedAt?: string } | null>(null);
  const dark = tone === "dark";
  const ca = staticCa ?? live?.ca ?? null;

  useEffect(() => {
    if (staticCa) return;
    let stop = false;
    const started = Date.now();
    const check = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/public?op=token", { cache: "no-store" });
        const j = await r.json();
        if (j?.live && BASE58.test(j.ca)) {
          setLive({ ca: j.ca, verifiedAt: j.verifiedAt });
          stop = true;
        }
      } catch {}
    };
    check();
    const id = setInterval(() => (Date.now() - started > 45 * 60e3 ? clearInterval(id) : check()), 20_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [staticCa]);

  async function copy() {
    if (!ca) return;
    try {
      await navigator.clipboard.writeText(ca);
    } catch {
      const t = document.createElement("textarea");
      t.value = ca;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      className={`relative border-2 border-dashed ${dark ? "border-paper/35 text-paper" : "border-ink/40 text-ink"} px-4 py-3.5 sm:px-5`}
      aria-live="polite"
    >
      <div className={`text-[10px] font-semibold tracking-[0.28em] uppercase ${dark ? "text-fog" : "text-faded"}`}>
        Contract address · Solana
      </div>
      {ca ? (
        <div className="mt-2 flex items-center gap-3">
          <code className="min-w-0 flex-1 text-[13px] break-all sm:text-sm">{ca}</code>
          <button
            type="button"
            onClick={copy}
            className={`inline-flex shrink-0 items-center gap-2 px-3 py-2 text-[11px] font-bold tracking-[0.15em] uppercase ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`}
            aria-label="Copy contract address"
          >
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
      {ca && !staticCa && live ? (
        <p className={`mt-2 text-[11px] leading-snug ${dark ? "text-fog" : "text-faded"}`}>
          Just launched — verified on-chain{live.verifiedAt ? ` at ${new Date(live.verifiedAt).toISOString().slice(11, 16)} UTC` : ""}. It must match the pinned X
          post and the pinned Telegram message.
        </p>
      ) : null}
      {ca ? null : (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className={`stamp text-sm sm:text-base ${dark ? "stamp-dark" : ""}`} style={{ ["--r" as string]: "-3deg" }}>
            Not launched yet
          </span>
          <span className={`text-[12px] leading-snug ${dark ? "text-fog" : "text-faded"}`}>
            {note}
          </span>
        </div>
      )}
    </div>
  );
}
