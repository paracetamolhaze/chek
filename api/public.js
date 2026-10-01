// Public, read-only data for the website: receipts (Receipt Board) and the live creator position.
import { AppError, cached, handle, json } from "../server/lib/http.js";
import { creatorPosition } from "../server/lib/onchain.js";
import { listReceipts, publicReceipt } from "../server/lib/receipts.js";

export async function GET(request) {
  return handle(async () => {
    const op = new URL(request.url).searchParams.get("op");
    if (op === "receipts") return cached({ receipts: (await listReceipts({ limit: 200 })).map(publicReceipt) }, 60);
    if (op === "creator") return cached(await creatorPosition(), 60);
    if (op === "ping") return json({ ok: true });
    throw new AppError(404, "unknown op");
  });
}
