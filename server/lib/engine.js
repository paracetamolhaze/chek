// CONTENT ENGINE: once a day decide what (if anything) is worth posting. Quality over quantity — zero posts is a valid day.
// Sources: new project receipts, lore, receipt-format jokes, polls. News arrives separately (news.js).
import { z } from "zod";
import { audit, getSetting } from "./core.js";
import { db } from "./db.js";
import { aiReady, structured } from "./llm.js";
import { enqueue } from "./queue.js";
import { receiptLabel } from "./receipts.js";
import { VOICE } from "./voice.js";

const Plan = z.object({
  posts: z
    .array(
      z.object({
        slot: z.enum(["morning", "day", "evening"]),
        channels: z.enum(["x", "telegram", "both"]),
        format: z.enum(["one_liner", "receipt_image", "lore", "poll", "transparency", "reaction"]),
        category: z.enum(["meme", "lore", "community", "build", "transparency"]),
        text: z.string().describe("post text in the CHEK voice; ≤ 240 chars for X"),
        receipt: z
          .object({ headline: z.string(), items: z.array(z.tuple([z.string(), z.string()])), total: z.string().nullable(), stamp: z.enum(["VERIFIED", "UNVERIFIED", "VOID"]).nullable(), character: z.enum(["chek", "shredder", "coupon"]) })
          .nullable()
          .describe("only for format receipt_image: the joke receipt to render"),
        poll: z.object({ question: z.string(), options: z.array(z.string()).min(2).max(4) }).nullable(),
        why: z.string().describe("one line: why this is worth posting today"),
      }),
    )
    .max(3),
});

// slot "09:30" today (UTC) ± jitter so the account doesn't post at robotic times
function slotTimeToday(hhmm, jitterMin = 25) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + Math.round((Math.random() * 2 - 1) * jitterMin));
  return d < new Date() ? new Date(Date.now() + 10 * 60e3) : d;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

export async function runEngine() {
  const sql = await db();
  const cadence = await getSetting("cadence");
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
        publishAfter: slotTimeToday(cadence.evening).toISOString(),
        payload: {
          parts: [`${receiptLabel(r)}\n${r.title}\n${r.status}${r.verification === "onchain" ? "\nON-CHAIN VERIFIED" : ""}${r.proof_url ? `\n${r.proof_url}` : ""}`],
          imageUrl: `/api/image?receipt=${r.number}`,
        },
      });
      queued++;
    }
  }

  // 2. Authored posts (AI): only if a key exists and the budget allows.
  if (aiReady()) {
    const recent = await sql`select payload->'parts'->>0 as text, published_at from chek.queue where status = 'published' order by published_at desc limit 15`;
    const plan = await structured({
      agent: "content",
      schema: Plan,
      system: `${VOICE}\n\nYou plan today's CHEK posts. Return 0–3 posts. Mix formats; never repeat a recent joke. Receipt images should be recognizable without a logo: itemized lines, a status, a total.`,
      prompt: `Today (UTC): ${today}\nCadence slots: morning ${cadence.morning}, day ${cadence.day}, evening ${cadence.evening}\n\nRecently published (newest first):\n${recent.map((r) => `- ${r.text}`).join("\n") || "(nothing yet)"}\n\nPlan today's posts. Return an empty list if nothing is good enough.`,
      effort: "medium",
    });
    for (const [i, p] of (plan?.posts ?? []).entries()) {
      const at = slotTimeToday(cadence[p.slot]).toISOString();
      const imageUrl = p.format === "receipt_image" && p.receipt ? `/api/image?gen=${b64({ ...p.receipt, format: "square" })}` : null;
      for (const platform of p.channels === "both" ? ["x", "telegram"] : [p.channels]) {
        await enqueue({
          id: `eng-${today}-${i}-${platform}`,
          platform,
          category: p.category,
          level: "auto", // guards escalate to review when needed
          origin: "engine",
          publishAfter: at,
          payload: { parts: [p.text], imageUrl, poll: p.format === "poll" ? p.poll : null, why: p.why },
        });
        queued++;
      }
    }
    await audit("content", "plan.made", "ok", { detail: { posts: plan?.posts?.length ?? 0 } });
  } else {
    await audit("content", "plan.skipped_ai", "skip", { detail: { reason: "no ANTHROPIC_API_KEY — only receipt posts" } });
  }
  return { queued };
}
