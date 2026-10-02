"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DEFAULT_STAMP, LIMITS, STAMPS, checkClaim, claimCode, claimQuery, printDate, type Stamp } from "../../../shared/claim.mjs";
import { claimReceiptSvg } from "@/lib/claimReceiptSvg";
import { IconCheck, IconCopy, IconDownload, IconWarn, XLogo } from "./icons";

// The public Receipt Generator: a claim in, a shareable receipt out. Same rules as the server (shared/claim.mjs);
// the preview is the server image's layout drawn in the browser. No cookies, no storage — only fire-and-forget counters.

type Hit = "gen" | "share" | "download" | "copy";
function hit(e: Hit) {
  try {
    fetch("/api/public?op=hit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ e }), keepalive: true }).catch(() => {});
  } catch {
    // counters are best-effort
  }
}

const EXAMPLE = "Trust me bro";
const HINT: Record<Stamp, string> = {
  UNVERIFIED: "no proof yet",
  VOID: "doesn't count",
  "PROOF PENDING": "still waiting",
  "NO RECEIPT": "nothing to show",
};
const chars = (s: string) => Array.from(s).length;

// X counts most characters as 1, emoji and CJK as 2, and every link as 23.
const xLen = (s: string) =>
  Array.from(s).reduce((n, c) => {
    const cp = c.codePointAt(0)!;
    return n + (cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247) ? 1 : 2);
  }, 0);
function shareText(claim: string, handle: string) {
  const head = "receipt printed 🧾 ";
  const budget = 280 - 24 - xLen(` via ${handle}`) - xLen(head) - 2; // link, via, quotes
  if (xLen(claim) <= budget) return `${head}“${claim}”`;
  const c = Array.from(claim);
  while (c.length && xLen(c.join("")) > budget - 1) c.pop();
  return `${head}“${c.join("").trimEnd()}…”`;
}

export function ReceiptMaker({ site, host, handle }: { site: string; host: string; handle: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [claim, setClaim] = useState("");
  const [name, setName] = useState("");
  const [stamp, setStamp] = useState<Stamp>(DEFAULT_STAMP);
  const [touched, setTouched] = useState(false);
  const [fromLink, setFromLink] = useState(false);
  const [today, setToday] = useState("");
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const claimRef = useRef<HTMLTextAreaElement>(null);
  const counted = useRef(new Set<string>());

  // Right after hydration (the static HTML can't know them): the visitor's date, and a shared link's claim
  // (/print?c=…&n=…&s=…). A timeout, not requestAnimationFrame: that never fires in a background tab.
  useEffect(() => {
    const t = setTimeout(() => {
      setToday(printDate(new Date()));
      setReady(true);
      const q = new URLSearchParams(window.location.search);
      const c = q.get("c");
      if (!c) return;
      const r = checkClaim({ claim: c, name: q.get("n") ?? "", stamp: q.get("s") ?? "" });
      setClaim(r.claim);
      setName(r.name);
      setStamp(r.stamp);
      setTouched(true);
      if (r.ok) {
        setFromLink(true);
        counted.current.add(claimCode(r.claim)); // opening a shared receipt is not a new one
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const r = useMemo(() => checkClaim({ claim, name, stamp }), [claim, name, stamp]);
  const code = r.ok ? claimCode(r.claim) : "";
  const query = r.ok ? claimQuery(r) : "";
  const link = r.ok ? `${site}/r?${query}` : "";
  const svg = useMemo(
    () => claimReceiptSvg({ claim: r.claim || EXAMPLE, name: r.name, stamp: r.stamp, date: today, host, handle, idPrefix: `cr${uid}` }),
    [r.claim, r.name, r.stamp, today, host, handle, uid],
  );

  // Once typing settles: keep the address bar on this receipt, count one "gen" per distinct claim.
  useEffect(() => {
    if (!ready) return; // never touch the address bar before a shared link's claim is read
    const t = setTimeout(() => {
      if (r.ok) {
        window.history.replaceState(null, "", `/print?${query}`);
        if (!counted.current.has(code)) {
          counted.current.add(code);
          hit("gen");
        }
      } else if (!r.claim && window.location.search) window.history.replaceState(null, "", "/print");
    }, 1200);
    return () => clearTimeout(t);
  }, [ready, r.ok, r.claim, query, code]);

  const xHref = r.ok
    ? `https://x.com/intent/post?text=${encodeURIComponent(shareText(r.claim, handle))}&url=${encodeURIComponent(link)}&via=${encodeURIComponent(handle.replace(/^@/, ""))}`
    : "";

  // The receipt PNG (square), fetched once per receipt and reused by Share / Download.
  const pngCache = useRef<{ key: string; blob: Promise<Blob> } | null>(null);
  function receiptPng(): Promise<Blob> {
    const key = claimQuery(r, { short: false });
    if (pngCache.current?.key !== key) {
      const blob = fetch(`/api/image?${key}&format=square`).then(async (res) => {
        if (!res.ok) {
          const msg = await res.json().then((d: { error?: string }) => d.error ?? "").catch(() => "");
          throw new Error(res.status === 400 && msg ? msg : "");
        }
        return res.blob();
      });
      blob.catch(() => (pngCache.current = null));
      pngCache.current = { key, blob };
    }
    return pngCache.current.blob;
  }
  // warm the image as soon as a receipt is valid, so sharing is instant
  useEffect(() => {
    if (!r.ok || !ready) return;
    const t = setTimeout(() => receiptPng().catch(() => {}), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.ok, ready, query]);

  // X takes only text + a link from a website, never an attached file:
  //  · phones: the system share sheet with the PNG attached (the visitor picks X there);
  //  · computers: X opens with the text + link, and the link unfurls into the receipt image (summary_large_image card).
  // The link in the text still unfurls into the receipt card for everyone who sees the post.
  async function shareX(e: React.MouseEvent) {
    if (!r.ok) return;
    e.preventDefault();
    hit("share");
    const text = `${shareText(r.claim, handle)} ${link} via ${handle}`;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.canShare === "function") {
      try {
        const file = new File([await receiptPng()], `chek-receipt-${code}.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
      window.open(xHref, "_blank", "noopener");
      return;
    }
    // computers: X opens with the text; the link in it unfurls into the full receipt image in the post
    const w = window.open(xHref, "_blank");
    if (w) w.opener = null;
    else window.location.href = xHref;
  }

  async function download() {
    if (!r.ok || busy) return;
    setBusy(true);
    setNote("");
    try {
      const url = URL.createObjectURL(await receiptPng());
      const a = document.createElement("a");
      a.href = url;
      a.download = `chek-receipt-${code}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      hit("download");
    } catch (e) {
      setNote(e instanceof Error && e.message ? e.message : "Couldn't print the image right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!r.ok) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (ok) {
      setNote("");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      hit("copy");
    } else setNote(`Couldn't copy. The link: ${link}`);
  }

  function printOwn() {
    setClaim("");
    setName("");
    setStamp(DEFAULT_STAMP);
    setTouched(false);
    setFromLink(false);
    setNote("");
    window.history.replaceState(null, "", "/print");
    claimRef.current?.focus();
  }

  const showClaimProblems = touched && r.by.claim.length > 0;
  const count = chars(r.claim);
  const btn = "inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold tracking-[0.16em] uppercase";

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-x-12">
      <section aria-label="Write a claim" className="paper edge-both min-w-0 px-5 pt-10 pb-11 shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] sm:px-8">
        {fromLink && (
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-ink bg-marker px-3 py-2.5">
            <p className="text-[13px] font-semibold">Someone printed this receipt.</p>
            <button type="button" onClick={printOwn} className="ml-auto text-[11px] font-bold tracking-[0.16em] uppercase underline underline-offset-4">
              Print your own →
            </button>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 text-[11px] font-bold tracking-[0.2em] uppercase">
          <label htmlFor={`${uid}-claim`}>The claim</label>
          <span className={count > LIMITS.claimMax ? "text-stamp" : "text-faded"} aria-hidden>
            {count}/{LIMITS.claimMax}
          </span>
        </div>
        <textarea
          id={`${uid}-claim`}
          ref={claimRef}
          value={claim}
          onChange={(e) => {
            setClaim(e.target.value);
            setTouched(true);
            setFromLink(false);
          }}
          rows={3}
          maxLength={LIMITS.claimMax + 60}
          placeholder="e.g. I'll pay you back on Friday"
          aria-invalid={showClaimProblems}
          aria-describedby={`${uid}-claim-help`}
          className="mt-2 block w-full resize-none border-2 border-ink bg-paper px-3 py-2.5 text-[16px] leading-snug placeholder:text-faded/70"
        />
        <div id={`${uid}-claim-help`} className="mt-2 min-h-5 text-[12px] leading-snug" aria-live="polite">
          {showClaimProblems ? (
            <ul className="space-y-1 text-stamp">
              {r.by.claim.map((p) => (
                <li key={p} className="flex gap-1.5">
                  <IconWarn className="mt-px size-3.5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          ) : r.dropped > 0 ? (
            <p className="text-faded">Emoji and some symbols don&apos;t print on thermal paper, so they&apos;re left out.</p>
          ) : (
            <p className="text-faded">No links, wallet addresses, @handles or $cashtags. Keep it clean.</p>
          )}
        </div>

        <label htmlFor={`${uid}-name`} className="mt-5 block text-[11px] font-bold tracking-[0.2em] uppercase">
          Claimed by <span className="font-semibold tracking-[0.12em] text-faded normal-case">(optional)</span>
        </label>
        <input
          id={`${uid}-name`}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setFromLink(false);
          }}
          maxLength={LIMITS.nameMax + 16}
          autoComplete="off"
          placeholder="e.g. my landlord"
          aria-invalid={r.by.name.length > 0}
          aria-describedby={`${uid}-name-help`}
          className="mt-2 block w-full border-2 border-ink bg-paper px-3 py-2.5 text-[16px] placeholder:text-faded/70"
        />
        <div id={`${uid}-name-help`} className="mt-2 min-h-5 text-[12px] leading-snug text-stamp" aria-live="polite">
          {r.by.name.map((p) => (
            <p key={p} className="flex gap-1.5">
              <IconWarn className="mt-px size-3.5 shrink-0" />
              {p}
            </p>
          ))}
        </div>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-bold tracking-[0.2em] uppercase">Stamp</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {STAMPS.map((s) => (
              <label
                key={s}
                className={`flex min-w-0 cursor-pointer flex-col border-2 px-3 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marker ${
                  stamp === s ? "border-stamp bg-stamp/5 text-stamp" : "border-ink/25 hover:border-ink"
                }`}
              >
                <input
                  type="radio"
                  name={`${uid}-stamp`}
                  value={s}
                  checked={stamp === s}
                  onChange={() => {
                    setStamp(s);
                    setFromLink(false);
                  }}
                  className="sr-only"
                />
                <span className="text-[12px] font-extrabold tracking-[0.08em] [font-stretch:75%] sm:text-[13px]">{s}</span>
                <span className="text-[11px] text-faded">{HINT[s]}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-faded">Visitor receipts are never stamped VERIFIED. That stamp is only for the project&apos;s own records.</p>
        </fieldset>
      </section>

      <figure className="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="relative">
          <div
            className={`border border-paper/10 bg-counter [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${r.claim && !r.ok ? "opacity-60" : ""}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          {r.claim && !r.ok && (
            <span className="stamp stamp-dark absolute top-4 left-4 bg-counter/80 text-[13px]" style={{ ["--r" as string]: "-4deg" }}>
              Won&apos;t print
            </span>
          )}
        </div>
        <figcaption className="mt-2 text-[11px] tracking-[0.14em] text-fog uppercase">
          {!r.claim ? "Example · write your own" : r.ok ? `Live preview · ${code}` : "Preview · fix the claim to print"}
        </figcaption>
      </figure>

      <section aria-label="Share" className="min-w-0 lg:col-start-1 lg:row-start-2">
        <div className="flex flex-wrap gap-3">
          {r.ok ? (
            <a href={xHref} target="_blank" rel="noopener noreferrer" onClick={shareX} className={`${btn} bg-marker text-ink hover:bg-paper`}>
              <XLogo className="size-4" /> Share on X
            </a>
          ) : (
            <span aria-disabled="true" className={`${btn} cursor-not-allowed bg-marker/40 text-ink/70`}>
              <XLogo className="size-4" /> Share on X
            </span>
          )}
          <button type="button" onClick={download} disabled={!r.ok || busy} className={`${btn} border-2 border-paper/30 text-paper hover:border-paper disabled:cursor-not-allowed disabled:opacity-40`}>
            <IconDownload className="size-4" /> {busy ? "Printing…" : "Download PNG"}
          </button>
          <button type="button" onClick={copy} disabled={!r.ok} className={`${btn} border-2 border-paper/30 text-paper hover:border-paper disabled:cursor-not-allowed disabled:opacity-40`}>
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />} {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="mt-3 min-h-5 text-[12px] break-words text-fog" role="status" aria-live="polite">
          {note || (r.ok ? "" : r.claim ? "Fix the claim to print it." : "Write a claim to print it.")}
        </p>
      </section>
    </div>
  );
}
