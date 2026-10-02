"use client";

import { useEffect, useState } from "react";

type Counts = { x: number; telegram: number };

// Live number of drop entries per drop (anonymous counts from the API; no addresses are shown here).
export function DropCount({ which }: { which?: keyof Counts }) {
  const [c, setC] = useState<Counts | null>(null);
  useEffect(() => {
    fetch("/api/public?op=drop")
      .then((r) => r.json())
      .then((j: { x?: { entries: number }; telegram?: { entries: number } }) =>
        setC(j.x && j.telegram ? { x: j.x.entries, telegram: j.telegram.entries } : null),
      )
      .catch(() => {});
  }, []);
  if (!c) return null;
  const n = (v: number) => `${v.toLocaleString("en-US")} ${v === 1 ? "entry" : "entries"}`;
  return (
    <p className={`mt-4 text-[12px] font-semibold tracking-[0.2em] uppercase ${which ? "text-ink" : "text-marker"}`}>
      {which ? `${n(c[which])} so far` : `X drop: ${n(c.x)} · Telegram drop: ${n(c.telegram)}`}
    </p>
  );
}
