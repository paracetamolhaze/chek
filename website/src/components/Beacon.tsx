"use client";

import { useEffect } from "react";

// Anonymous, cookieless counters: where a visit came from (once per tab session) and which section was opened
// (once per page load). Nothing identifying is stored or sent — just one event name per request.
const SECTIONS: Record<string, string> = { "": "pv_home", drop: "pv_drop", print: "pv_print", receipts: "pv_receipts", transparency: "pv_transparency" };

export function Beacon() {
  useEffect(() => {
    let src = "visit_direct";
    try {
      const ref = document.referrer ? new URL(document.referrer).hostname : "";
      const tag = new URLSearchParams(location.search).get("ref") || "";
      if (/(^|\.)(x|twitter)\.com$|^t\.co$/.test(ref) || tag === "x") src = "visit_x";
      else if (/(^|\.)t\.me$|telegram/.test(ref) || tag === "tg") src = "visit_tg";
      else if (ref && ref !== location.hostname) src = "visit_other";
      else if (ref === location.hostname) src = "";
    } catch {}
    const section = SECTIONS[location.pathname.split("/")[1] ?? ""] ?? "pv_other";
    const hit = (e: string) =>
      fetch("/api/public?op=hit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ e }), keepalive: true }).catch(() => {});
    hit(section);
    if (src && !sessionStorageSafe()) hit(src);
  }, []);
  return null;
}

// one count per tab session; if storage is blocked we still count once per page load
function sessionStorageSafe() {
  try {
    if (sessionStorage.getItem("chek-hit")) return true;
    sessionStorage.setItem("chek-hit", "1");
  } catch {}
  return false;
}
