"use client";

import { useEffect } from "react";

// Anonymous, cookieless: counts visits that arrive from X or Telegram (format signal for the content engine).
// Nothing is stored in the browser and no identifier is sent — just one event name.
export function Beacon() {
  useEffect(() => {
    let src = "";
    try {
      const ref = document.referrer ? new URL(document.referrer).hostname : "";
      const tag = new URLSearchParams(location.search).get("ref") || "";
      if (/(^|\.)(x|twitter)\.com$|^t\.co$/.test(ref) || tag === "x") src = "visit_x";
      else if (/(^|\.)t\.me$|telegram/.test(ref) || tag === "tg") src = "visit_tg";
      else if (ref && ref !== location.hostname) src = "visit_other";
    } catch {}
    if (!src || sessionStorageSafe()) return;
    fetch("/api/public?op=hit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ e: src }), keepalive: true }).catch(() => {});
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
