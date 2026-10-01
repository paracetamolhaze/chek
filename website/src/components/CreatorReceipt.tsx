"use client";

import { useEffect, useState } from "react";

type Live = { live: boolean; holding?: number; pct?: number | null; unclaimedCreatorFeesSol?: number | null; readAt?: string };

// THE CREATOR RECEIPT. Facts at creation come from config (written after on-chain verification);
// the current holding is read from Solana through the backend, every visit.
export function CreatorReceipt(props: {
  ticker: string;
  createdAt: string | null;
  wallet: string | null;
  buySol: string | null;
  buyUsd: string | null;
  tokens: string | null;
  pct: string | null;
  creationTx: string | null;
}) {
  const [live, setLive] = useState<Live | null>(null);
  const launched = Boolean(props.wallet && props.creationTx);

  useEffect(() => {
    if (!launched) return;
    fetch("/api/public?op=creator")
      .then((r) => (r.ok ? r.json() : null))
      .then(setLive)
      .catch(() => {});
  }, [launched]);

  const rows: [string, React.ReactNode][] = [
    ["Created", props.createdAt ? new Date(props.createdAt).toUTCString().replace("GMT", "UTC") : "—"],
    [
      "Creator wallet",
      props.wallet ? (
        <a className="break-all underline" href={`https://solscan.io/account/${props.wallet}`} target="_blank" rel="noopener noreferrer">
          {props.wallet}
        </a>
      ) : (
        "—"
      ),
    ],
    ["Initial buy", props.buySol ? `${props.buySol} SOL${props.buyUsd ? ` (≈ ${props.buyUsd})` : ""}` : "—"],
    ["Tokens received", props.tokens ? `${props.tokens} ${props.ticker}` : "—"],
    ["Share of total supply", props.pct ?? "—"],
    [
      "Transaction",
      props.creationTx ? (
        <a className="underline" href={`https://solscan.io/tx/${props.creationTx}`} target="_blank" rel="noopener noreferrer">
          View on explorer
        </a>
      ) : (
        "—"
      ),
    ],
    [
      "Current creator holding",
      !launched ? "—" : live?.live ? `${Math.round(live.holding ?? 0).toLocaleString("en-US")} ${props.ticker} · ${live.pct?.toFixed(2)}%` : "reading the chain…",
    ],
    ["Unclaimed creator fees", !launched ? "—" : live?.live && live.unclaimedCreatorFeesSol !== null && live.unclaimedCreatorFeesSol !== undefined ? `${live.unclaimedCreatorFeesSol.toFixed(4)} SOL` : "—"],
  ];

  return (
    <div className="border-2 border-ink p-5 sm:p-6">
      <div className="text-[10px] font-bold tracking-[0.3em] text-faded uppercase">The creator receipt</div>
      <dl className="mt-3">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[150px_1fr] gap-3 border-b-2 border-dotted border-ink/20 py-2.5 text-[13px] sm:grid-cols-[210px_1fr]">
            <dt className="font-semibold tracking-[0.08em] uppercase">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] leading-relaxed text-faded">
        {launched
          ? `Facts at creation come from the creation transaction. The current holding is read from Solana on every visit${live?.readAt ? ` (read ${new Date(live.readAt).toISOString().slice(11, 16)} UTC)` : ""}.`
          : "Published the minute the token exists: the creator wallet, the real buy at creation and its transaction. No other wallets."}
      </p>
    </div>
  );
}
