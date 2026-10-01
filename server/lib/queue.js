// CONTENT QUEUE: one table for every channel. Items wait until they are due, their conditions hold,
// and (for level=review) the owner approved them. Placeholders are filled at publish time — never earlier.
import { fill, placeholders, slotTime } from "../../shared/content-core.mjs";
import { audit, getSetting } from "./core.js";
import { db } from "./db.js";
import { officialCa, project, seedQueue } from "./project.js";

// Which placeholder needs which fact before a post may go out.
const NEEDS = {
  TG: "links.telegram",
  TG_URL: "links.telegram",
  TG_CHAT_URL: "links.telegramChat",
  X: "links.x",
  X_URL: "links.x",
  LAUNCH_UTC: "launchAt",
  CA: "live",
  CA_SHORT: "live",
  CREATED_AT: "live",
  SUPPLY: "live",
  MINT_AUTH: "live",
  FREEZE_AUTH: "live",
  CREATOR: "live",
  CREATOR_BUY: "live",
  CREATION_TX: "live",
  CREATION_FEE: "live",
  ROTW_ENTRIES: "input:ROTW_ENTRIES",
};

// Seed posts whose wording a human must re-confirm against reality at posting time.
const SEED_REVIEW = new Set(["x-022", "x-023", "tg-010", "tg-011"]);
// Seed wording a human already reviewed (lore quoting a fake promise, chat rules naming scammers).
const SEED_ACK = { "x-002": ["partnership / listing claim"], "tg-002": ["legal / accusation topic"] };
// Extra ordering conditions: post only after another item was published.
const SEED_AFTER = { "x-009": ["tg-001"], "x-017": ["tg-007"], "x-018": ["tg-007"] };

export function requiresFor(item) {
  const text = [item.text, ...(item.thread || [])].join("\n");
  const req = new Set();
  for (const m of text.matchAll(/\{\{([A-Z_]+)\}\}/g)) if (NEEDS[m[1]]) req.add(NEEDS[m[1]]);
  if (/^T[+-]/.test(item.slot)) req.add("launchAt");
  for (const id of SEED_AFTER[item.id] || []) req.add(`posted:${id}`);
  return [...req];
}

// Import / refresh prepared posts from content/*/queue.json. Never touches published items.
export async function syncSeed() {
  const sql = await db();
  const schedule = await getSetting("schedule");
  const q = seedQueue();
  let n = 0;
  for (const [platform, file] of [["x", q.x], ["telegram", q.telegram]]) {
    for (const item of file.posts) {
      if (item.kind === "welcome") continue; // bot welcome text, not a post
      const payload = { parts: [item.text, ...(item.thread || [])], asset: item.asset ?? null, pin: item.pin ?? null, where: item.where ?? null, note: item.note ?? null, ack: SEED_ACK[item.id] ?? [] };
      const level = SEED_REVIEW.has(item.id) ? "review" : "auto";
      const at = slotTime(item.slot, schedule);
      const status = item.status === "posted" ? "published" : item.status === "skipped" ? "skipped" : "ready";
      await sql`insert into chek.queue (id, platform, category, level, status, slot, publish_after, payload, requires, origin)
        values (${item.id}, ${platform}, ${item.category}, ${level}, ${status}, ${item.slot}, ${at}, ${sql.json(payload)}, ${sql.json(requiresFor(item))}, 'seed')
        on conflict (id) do update set
          payload = excluded.payload, requires = excluded.requires, slot = excluded.slot, category = excluded.category,
          publish_after = excluded.publish_after, level = excluded.level, updated_at = now()
        where chek.queue.status in ('ready','review','failed','expired')`;
      n++;
    }
  }
  await audit("publisher", "queue.seed_synced", "ok", { detail: { items: n } });
  return n;
}

// Recompute publish times after the schedule changes (d1 or launch time).
export async function reschedule() {
  const sql = await db();
  const schedule = await getSetting("schedule");
  const rows = await sql`select id, slot from chek.queue where status in ('ready','review','approved') and slot is not null`;
  for (const r of rows) await sql`update chek.queue set publish_after = ${slotTime(r.slot, schedule)}, updated_at = now() where id = ${r.id}`;
  return rows.length;
}

export async function enqueue(item) {
  const sql = await db();
  await sql`insert into chek.queue (id, platform, category, level, status, slot, publish_after, payload, requires, source, origin, receipt_id)
    values (${item.id}, ${item.platform}, ${item.category}, ${item.level}, ${item.level === "review" ? "review" : "ready"}, ${item.slot ?? null},
      ${item.publishAfter ?? new Date().toISOString()}, ${sql.json(item.payload)}, ${sql.json(item.requires ?? [])},
      ${item.source ? sql.json(item.source) : null}, ${item.origin}, ${item.receiptId ?? null})
    on conflict (id) do nothing`;
  await audit(item.origin, "queue.enqueued", "ok", { ref: item.id, detail: { platform: item.platform, level: item.level, category: item.category } });
}

// Are an item's conditions true right now?
export async function conditionsMet(row, ctx) {
  const missing = [];
  for (const r of row.requires || []) {
    if (r === "live" && !ctx.ca) missing.push(r);
    else if (r === "launchAt" && !ctx.schedule.launchAt) missing.push(r);
    else if (r.startsWith("links.") && !ctx.project.links[r.slice(6)]) missing.push(r);
    else if (r.startsWith("input:") && !ctx.inputs[r.slice(6)]) missing.push(r);
    else if (r.startsWith("posted:")) {
      const sql = await db();
      const [p] = await sql`select status from chek.queue where id = ${r.slice(7)}`;
      if (!p || p.status !== "published") missing.push(r);
    }
  }
  return missing;
}

export async function context() {
  const p = project();
  return { project: p, ca: officialCa(p), schedule: await getSetting("schedule"), inputs: (await getSetting("inputs")) || {} };
}

// Final text at the moment of publishing.
export function render(row, ctx, now = new Date()) {
  const values = placeholders(ctx.project, ctx.schedule, ctx.inputs, now);
  const parts = row.payload.parts.map((t) => fill(t, values));
  return { parts: parts.map((p) => p.text), missing: [...new Set(parts.flatMap((p) => p.missing))] };
}
