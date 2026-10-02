"use client";

import { useEffect, useState } from "react";

// Live number of drop entries (anonymous count from the API; no addresses are shown here).
export function DropCount() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/public?op=drop")
      .then((r) => r.json())
      .then((j: { entries?: number }) => setN(typeof j.entries === "number" ? j.entries : null))
      .catch(() => {});
  }, []);
  if (n === null) return null;
  return (
    <p className="mt-4 text-[12px] font-semibold tracking-[0.2em] text-marker uppercase">
      {n.toLocaleString("en-US")} {n === 1 ? "entry" : "entries"} so far
    </p>
  );
}
