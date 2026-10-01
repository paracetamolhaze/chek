// Receipt images for posts and the Receipt Board.
//   /api/image?receipt=42[&format=square|portrait|story|wide]   numbered project receipt (public, cached)
//   /api/image?gen=<base64url json>&s=<sig>[&format=…]          text receipt for automated posts — must be signed by the server
// The public Receipt Generator (phase 2) renders in the browser, so this endpoint never renders arbitrary public input.
import { db } from "../server/lib/db.js";
import { AppError, handle, safeEqual, sign } from "../server/lib/http.js";
import { renderReceipt, renderTextReceipt } from "../server/lib/render.js";

export const maxDuration = 30;

const MOOD = { fees: { expr: "happy", pose: "up" }, payout: { expr: "happy", pose: "up" }, creator: { expr: "skeptic", pose: "point", prop: "magnifier" }, build: { expr: "happy", pose: "point", prop: "stamp" } };
const png = (buf, seconds) => new Response(buf, { headers: { "content-type": "image/png", "cache-control": `public, max-age=${seconds}, s-maxage=${seconds}` } });

export const signGen = (payload) => sign(`img:${payload}`);

export async function GET(request) {
  return handle(async () => {
    const q = new URL(request.url).searchParams;
    const format = ["square", "portrait", "story", "wide"].includes(q.get("format")) ? q.get("format") : "square";
    if (q.get("receipt")) {
      const n = Number(q.get("receipt"));
      if (!Number.isInteger(n) || n < 1) throw new AppError(400, "bad receipt");
      const sql = await db();
      const [r] = await sql`select * from chek.receipts where number = ${n}`;
      if (!r) throw new AppError(404, "no such receipt");
      const onchain = r.verification === "onchain";
      const buf = await renderReceipt({
        number: r.number,
        title: r.title,
        status: r.status,
        verification: onchain ? "ON-CHAIN VERIFIED" : "PROJECT REPORTED",
        amount: r.amount === null ? undefined : `${Number(r.amount).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${r.currency ?? ""}`.trim(),
        date: r.occurred_at.toISOString?.() ?? r.occurred_at,
        proof: r.tx ? `TX ${r.tx.slice(0, 4)}…${r.tx.slice(-4)}` : r.proof_label ?? undefined,
        mascot: MOOD[r.kind] ?? MOOD.build,
        format,
      });
      return png(buf, 86400);
    }
    if (q.get("gen")) {
      const payload = q.get("gen");
      if (payload.length > 4000 || !safeEqual(q.get("s"), signGen(payload))) throw new AppError(403, "unsigned");
      const spec = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return png(await renderTextReceipt({ ...spec, format: spec.format ?? format }), 604800);
    }
    throw new AppError(400, "receipt or gen required");
  });
}
