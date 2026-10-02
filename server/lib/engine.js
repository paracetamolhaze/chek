// CONTENT ENGINE: once a day decide what (if anything) is worth posting. Quality over quantity — zero posts is a valid day.
// Sources: new project receipts (templates, no AI), lore, receipt-format jokes, claim receipts, polls (AI via ask()).
// News arrives separately (news.js); the prepared calendar lives in content/*/queue.json (seed).
import { z } from "zod";
import { audit, getSetting } from "./core.js";
import { db } from "./db.js";
import { ask } from "./llm.js";
import { enqueue } from "./queue.js";
import { assetLibrary, project } from "./project.js";
import { receiptLabel } from "./receipts.js";
import { VOICE } from "./voice.js";
import { sign } from "./http.js";

export const Plan = z.object({
  posts: z
    .array(
      z.object({
        slot: z.enum(["morning", "day", "evening"]),
        channels: z.enum(["x", "telegram", "both"]),
        format: z.enum(["one_liner", "receipt_image", "claim_receipt", "lore", "poll", "transparency", "reaction"]),
        category: z.enum(["meme", "lore", "community", "build", "transparency"]),
        text: z.string().describe("post text in the CHEK voice; ≤ 240 chars for X; usually no link"),
        receipt: z
          .object({ headline: z.string(), items: z.array(z.tuple([z.string(), z.string()])), total: z.string().nullable(), stamp: z.enum(["VERIFIED", "UNVERIFIED", "VOID"]).nullable(), character: z.enum(["chek", "shredder", "coupon"]) })
          .nullable()
          .describe("only for format receipt_image: the joke receipt to render"),
        claim: z
          .object({ text: z.string().describe("a generic, widely-heard claim (no names, no @handles, no tickers, no links), ≤ 120 chars"), stamp: z.enum(["UNVERIFIED", "VOID", "PROOF PENDING", "NO RECEIPT"]) })
          .nullable()
          .describe("only for format claim_receipt: rendered with the public Receipt Generator look"),
        poll: z.object({ question: z.string(), options: z.array(z.string()).min(2).max(4) }).nullable(),
        asset: z.string().nullable().describe("for formats other than receipt_image/claim_receipt: one file path from the ASSET LIBRARY (videos preferred), or null"),
        why: z.string().describe("one line: why this is worth posting today"),
      }),
    )
    .max(3),
});

// slot "09:30" on `day` (UTC) ± jitter so the account doesn't post at robotic times; never in the past.
function slotTimeOn(day, hhmm, jitterMin = 25) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCHours(h, m, 0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + Math.round((Math.random() * 2 - 1) * jitterMin));
  return d < new Date() ? new Date(Date.now() + 10 * 60e3) : d;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const tokenMention = (t) => /\$CHEKD\b/i.test(t);
const MAX_TOKEN_POSTS_PER_DAY = 2;

export async function runEngine() {
  const sql = await db();
  const cadence = await getSetting("cadence");
  const schedule = await getSetting("schedule");
  const today = new Date().toISOString().slice(0, 10);
  let queued = 0;

  // 1. Project receipts that were never posted → template posts with the receipt image (no AI needed).
  const fresh = await sql`select r.* from chek.receipts r
    where r.kind in ('feature','character','payout','expense','milestone','community','launch')
      and r.created_at > now() - interval '3 days'
      and not exists (select 1 from chek.queue q where q.receipt_id = r.id)
    order by r.number limit 3`;
  for (const r of fresh) {
    for (const platform of ["x", "telegram"]) {
      await enqueue({
        id: `rcpt-${r.number}-${platform}`,
        platform,
        category: "build",
        level: "auto",
        origin: "receipt",
        receiptId: r.id,
        publishAfter: slotTimeOn(today, cadence.evening).toISOString(),
        payload: {
          parts: [`${receiptLabel(r)}\n${r.title}\n${r.status}${r.verification === "onchain" ? "\nON-CHAIN VERIFIED" : ""}${r.proof_url ? `\n${r.proof_url}` : ""}`],
          imageUrl: `/api/image?receipt=${r.number}`,
          why: `new project receipt #${r.number}`,
        },
      });
      queued++;
    }
  }

  // 2. Authored posts (AI): queued for the PC agent (or run now with an API key).
  const recent = await sql`select payload->'parts'->>0 as text, coalesce(published_at, dry_at) as at from chek.queue
    where status in ('published','dry_published') order by coalesce(published_at, dry_at) desc limit 15`;
  const recentAssets = (await sql`select distinct payload->>'asset' as a from chek.queue where payload->>'asset' is not null and coalesce(published_at, dry_at, publish_after) > now() - interval '2 days'`).map((r) => r.a);
  const planned = await sql`select platform, slot, left(payload->'parts'->>0, 140) as text from chek.queue
    where status in ('ready','review','approved') and publish_after::date = ${today}::date order by publish_after`;
  const p = project();
  const res = await ask({
    kind: "engine_plan",
    schema: Plan,
    system: `${VOICE}\n\nYou plan today's extra CHEK posts on top of the prepared calendar. Return 0–3 posts. Mix formats; never repeat a recent joke or a planned post. Receipt images should be recognizable without a logo: itemized lines, a status, a total. At most one post may mention $CHEKD. No links unless the post is about the website itself.\n\nSpeak AS CHEK — the coin's own voice, confident and funny, with real momentum: show what exists (site, Receipt Generator, Telegram receipt bot, build log, receipt board, transparency), what is being built, what comes next and the plan for $CHEKD. Hype the project and the build, never the price. Pre-launch story, in this order: CHEK EXISTS → CHEK BUILDS → PEOPLE USE CHEK → THEN $CHEKD LAUNCHES. Before launch, X gets roughly 3–5 quality posts a day IN TOTAL including the planned calendar — only add what's missing to reach that. Every post should carry a strong visual: a video or image from the ASSET LIBRARY, or a receipt image. No fake urgency, no fake engagement, no fake community, no general crypto news.`,
    prompt: [
      `Today (UTC): ${today}`,
      `Project status: ${p.status === "live" ? "token live" : "pre-launch — the token does not exist yet"}`,
      `Public posting day: ${schedule?.d1 ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${schedule.d1}T00:00:00Z`)) / 86400e3) + 1 : "?"} (day 1 = ${schedule?.d1 ?? "?"}) · launch time: ${schedule?.launchAt ? `announced for ${schedule.launchAt}` : "not announced yet — never hint at a date"}`,
      `Live features people can use without buying anything: the build log (/history), the Receipt Board (/receipts), the Receipt Generator (/print — anyone writes a claim and gets a shareable receipt).`,
      `Cadence slots: morning ${cadence.morning}, day ${cadence.day}, evening ${cadence.evening}`,
      `Already planned for today (do not duplicate):\n${planned.map((r) => `- [${r.platform} ${r.slot ?? ""}] ${r.text}`).join("\n") || "(nothing)"}`,
      `Recently posted (newest first):\n${recent.map((r) => `- ${r.text}`).join("\n") || "(nothing yet)"}`,
      `ASSET LIBRARY (attach one via "asset"; don't reuse a file used in the last two days: ${recentAssets.join(", ") || "none used yet"}):\n${assetLibrary().map((a) => `- ${a.file} — ${a.kind}: ${a.about}`).join("\n")}`,
      `Plan today's extra posts. Return an empty list if nothing is good enough.`,
    ].join("\n\n"),
    meta: { today },
    effort: "medium",
    ttlMin: 180,
    onResult: applyPlan,
  });
  await audit("content", "plan.requested", "info", { detail: res });
  return { queued, ai: res };
}

// Applies an engine plan (from the API now, or from the PC agent later).
export async function applyPlan(plan, meta = {}) {
  const cadence = await getSetting("cadence");
  const day = meta.today || new Date().toISOString().slice(0, 10);
  let queued = 0;
  let tokenPosts = 0;
  for (const [i, post] of (plan?.posts ?? []).entries()) {
    if (tokenMention(post.text) && ++tokenPosts > MAX_TOKEN_POSTS_PER_DAY) continue; // the token is not the subject of every post
    const at = slotTimeOn(day, cadence[post.slot]).toISOString();
    let imageUrl = null;
    if (post.format === "receipt_image" && post.receipt) {
      const gen = b64({ ...post.receipt, format: "square" });
      imageUrl = `/api/image?gen=${gen}&s=${sign(`img:${gen}`)}`;
    } else if (post.format === "claim_receipt" && post.claim) {
      imageUrl = `/api/image?${new URLSearchParams({ claim: post.claim.text, stamp: post.claim.stamp, format: "square" })}`;
    }
    const asset = !imageUrl && post.asset && assetLibrary().some((a) => a.file === post.asset) ? post.asset : null;
    for (const platform of post.channels === "both" ? ["x", "telegram"] : [post.channels]) {
      await enqueue({
        id: `eng-${day}-${i}-${platform}`,
        platform,
        category: post.category,
        level: "auto", // guards escalate to review when needed
        origin: "engine",
        publishAfter: at,
        payload: { parts: [post.text], imageUrl, asset, poll: post.format === "poll" ? post.poll : null, format: post.format, why: post.why },
      });
      queued++;
    }
  }
  await audit("content", "plan.applied", "ok", { detail: { posts: plan?.posts?.length ?? 0, queued } });
  return { queued };
}
