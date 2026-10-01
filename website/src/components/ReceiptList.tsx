"use client";

import { useEffect, useState } from "react";

export type PublicReceipt = {
  number: number;
  label: string;
  kind: string;
  title: string;
  status: string;
  verification: "ON-CHAIN VERIFIED" | "PROJECT REPORTED";
  amount: number | null;
  currency: string | null;
  txUrl: string | null;
  proofUrl: string | null;
  proofLabel: string | null;
  occurredAt: string;
  detail: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).toUpperCase() + " UTC";

// Receipts from the backend (live), falling back to the build-time list when the API is unavailable.
export function ReceiptList({ initial }: { initial: PublicReceipt[] }) {
  const [items, setItems] = useState(initial);
  const [source, setSource] = useState<"build" | "live">("build");
  const [filter, setFilter] = useState<"all" | "onchain" | "reported">("all");

  useEffect(() => {
    fetch("/api/public?op=receipts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (Array.isArray(d.receipts) && d.receipts.length) {
          setItems(d.receipts);
          setSource("live");
        }
      })
      .catch(() => {});
  }, []);

  const shown = items.filter((r) => filter === "all" || (filter === "onchain" ? r.verification === "ON-CHAIN VERIFIED" : r.verification === "PROJECT REPORTED"));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.14em] uppercase">
        {(["all", "onchain", "reported"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`border-2 border-ink px-2.5 py-1.5 ${filter === f ? "bg-ink text-paper" : ""}`}
            aria-pressed={filter === f}
          >
            {f === "all" ? `All (${items.length})` : f === "onchain" ? "On-chain verified" : "Project reported"}
          </button>
        ))}
        <span className="ml-auto text-faded">{source === "live" ? "live data" : "from the last site build"}</span>
      </div>
      {shown.length === 0 && <p className="py-6 text-[14px] text-faded">Nothing here yet. On-chain receipts start at launch.</p>}
      <ol>
        {shown.map((r) => (
          <li key={r.number} className="grid gap-x-5 gap-y-1 border-b-2 border-dotted border-ink/20 py-4 sm:grid-cols-[96px_1fr_auto]">
            <div className="font-display text-2xl leading-none font-black">{r.label}</div>
            <div>
              <div className="text-[15px] font-extrabold">
                {r.title}
                {r.amount !== null && (
                  <span className="ml-2 font-semibold">
                    · {r.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} {r.currency}
                  </span>
                )}
              </div>
              {r.detail && <p className="mt-1 text-[13px] leading-relaxed">{r.detail}</p>}
              <p className="mt-1.5 text-[11px] font-semibold tracking-[0.12em] text-faded uppercase">
                {fmt(r.occurredAt)} ·{" "}
                {r.txUrl ? (
                  <a className="text-ink underline" href={r.txUrl} target="_blank" rel="noopener noreferrer">
                    transaction
                  </a>
                ) : r.proofUrl ? (
                  <a className="text-ink underline" href={r.proofUrl} target="_blank" rel="noopener noreferrer">
                    {r.proofLabel ?? "proof"}
                  </a>
                ) : (
                  <span className="text-ink">{r.proofLabel ?? "no external proof yet"}</span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="border-2 border-ink px-2 py-0.5 text-[10px] font-black tracking-[0.16em] uppercase">{r.status}</span>
              <span className={`text-[10px] font-bold tracking-[0.14em] uppercase ${r.verification === "ON-CHAIN VERIFIED" ? "text-ok" : "text-faded"}`}>
                {r.verification}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
