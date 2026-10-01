// Public, read-only data for the website + anonymous usage counters.
//   GET  ?op=token     official token facts once the mint is verified (the CA box switches from this within seconds)
//   GET  ?op=receipts  Receipt Board
//   GET  ?op=creator   live creator position (read from the chain)
//   POST ?op=hit {e}   anonymous counter (receipt generator usage, visits from X/Telegram) — no cookies, no IPs stored
import { bump, getSetting } from "../server/lib/core.js";
import { AppError, cached, handle, json, readJson } from "../server/lib/http.js";
import { creatorPosition } from "../server/lib/onchain.js";
import { listReceipts, publicReceipt } from "../server/lib/receipts.js";

const EVENTS = { gen: "rg_gen", share: "rg_share", download: "rg_download", copy: "rg_copy", visit_x: "visit_x", visit_tg: "visit_tg", visit_other: "visit_other" };

export async function GET(request) {
  return handle(async () => {
    const op = new URL(request.url).searchParams.get("op");
    if (op === "token") {
      const t = await getSetting("token_live").catch(() => null);
      return cached(t?.ca ? { live: true, ca: t.ca, createdAt: t.createdAt, creationTx: t.creationTx, verifiedAt: t.verifiedAt } : { live: false }, 10);
    }
    if (op === "receipts") return cached({ receipts: (await listReceipts({ limit: 200 })).map(publicReceipt) }, 60);
    if (op === "creator") return cached(await creatorPosition(), 60);
    if (op === "ping") return json({ ok: true });
    throw new AppError(404, "unknown op");
  });
}

export async function POST(request) {
  return handle(async () => {
    const op = new URL(request.url).searchParams.get("op");
    if (op !== "hit") throw new AppError(404, "unknown op");
    const b = await readJson(request).catch(() => ({}));
    const key = EVENTS[b?.e];
    if (!key) throw new AppError(400, "unknown event");
    await bump(key);
    return json({ ok: true });
  });
}
