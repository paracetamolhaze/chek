"use client";

import { useEffect, useState } from "react";

type Winner = { handle: string; wallet: string };
type Drawn = { round: number; post: string | null; closesAt: string; slot: number; blockhash: string; entries: number; wallets: string[]; winners: Winner[] };
type Open = { round: number; post: string | null; closesAt: string; entries: number };
type Data = { rule: string; drawn: Drawn[]; open: Open[] };

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const utc = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Re-runs a round's draw in the browser from the published inputs: score = sha256(blockhash + ":" + address), lowest win.
async function recheck(d: Drawn) {
  const scored = await Promise.all([...new Set(d.wallets)].map(async (w) => ({ w, s: await sha256(`${d.blockhash}:${w}`) })));
  scored.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));
  const mine = scored.slice(0, d.winners.length).map((x) => x.w);
  return mine.length === d.winners.length && mine.every((w, i) => w === d.winners[i].wallet);
}

export function DropResults() {
  const [data, setData] = useState<Data | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  useEffect(() => {
    fetch("/api/public?op=drop_results")
      .then((r) => r.json())
      .then((j: Data) => (Array.isArray(j.drawn) ? setData(j) : null))
      .catch(() => {});
  }, []);
  if (!data) return <p className="text-[13px] text-faded">Loading rounds…</p>;
  const rounds = [...data.drawn.map((d) => ({ kind: "drawn" as const, ...d })), ...data.open.map((o) => ({ kind: "open" as const, ...o }))].sort(
    (a, b) => b.round - a.round,
  );
  if (!rounds.length) return <p className="text-[13px] text-faded">No rounds posted yet.</p>;
  return (
    <div className="space-y-4">
      {rounds.map((r) => (
        <div key={r.round} id={`round-${r.round}`} className="border-2 border-ink p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-bold tracking-[0.18em] uppercase">
              Round {r.round}{" "}
              {r.post ? (
                <a className="font-semibold tracking-normal normal-case underline" href={r.post} target="_blank" rel="noopener noreferrer">
                  post
                </a>
              ) : null}
            </p>
            <p className="text-[12px] text-faded">
              {r.kind === "open" ? `open · closes ${utc(r.closesAt)}` : `closed ${utc(r.closesAt)}`} · {r.entries} {r.entries === 1 ? "entry" : "entries"}
            </p>
          </div>
          {r.kind === "drawn" ? (
            <>
              <p className="mt-3 text-[12px] leading-relaxed break-all text-faded">
                Seed: Solana block{" "}
                <a className="underline" href={`https://solscan.io/block/${r.slot}`} target="_blank" rel="noopener noreferrer">
                  {r.slot}
                </a>{" "}
                · blockhash {r.blockhash}
              </p>
              {r.winners.length ? (
                <ol className="mt-3 space-y-1 text-[14px]">
                  {r.winners.map((w, i) => (
                    <li key={w.wallet} className="flex flex-wrap gap-x-3">
                      <span className="font-bold">{i + 1}.</span>
                      <a className="underline" href={`https://x.com/${w.handle}`} target="_blank" rel="noopener noreferrer">
                        @{w.handle}
                      </a>
                      <span className="text-faded">{short(w.wallet)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-[13px]">No entries were locked in for this round.</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
                {r.winners.length ? (
                  <button
                    type="button"
                    className="border-2 border-ink px-3 py-1.5 font-bold tracking-[0.14em] uppercase"
                    onClick={() => recheck(r).then((ok) => setChecked((c) => ({ ...c, [r.round]: ok })))}
                  >
                    Re-check in my browser
                  </button>
                ) : null}
                {checked[r.round] === true ? <span className="font-bold">✓ same winners</span> : checked[r.round] === false ? <span className="text-stamp font-bold">✗ mismatch</span> : null}
                <details>
                  <summary className="cursor-pointer underline">all {r.wallets.length} addresses</summary>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed break-all">{r.wallets.join(" ")}</p>
                </details>
              </div>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
