// SCHEDULER: one entry point called every few minutes (Supabase pg_cron → /api/cron; Vercel Cron once a day as backup).
// Each job has its own frequency, tracked in settings, so the tick interval can change without changing behaviour.
import { runRoundDraws } from "./draw.js";
import { sendPendingReplies } from "./inbox.js";
import { alert, allSettings, audit, gauge, getSetting, recordCost, setSetting, spend } from "./core.js";
import { db } from "./db.js";
import { runEngine } from "./engine.js";
import { env, integrations } from "./env.js";
import { expireJobs } from "./ai-jobs.js";
import { evaluateNews, fetchFeeds } from "./news.js";
import { runWatcher } from "./onchain.js";
import { runProdAudit } from "./prodcheck.js";
import { project } from "./project.js";
import { runPublisher } from "./publisher.js";
import { enqueue } from "./queue.js";
import { chatFromLink, notifyOwner, tg } from "./telegram.js";
import { mentions, xReady } from "./x.js";
import { expireHandoffs } from "./xhandoff.js";
import { checkClaim } from "../../shared/claim.mjs";

// Telegram turns itself on once the owner made the bot an admin of the channel (post + edit/pin rights).
async function telegramRights() {
  const s = await allSettings();
  const p = project();
  if (!integrations().telegram || !p.links.telegram) return { skipped: true };
  // comments: the channel's linked discussion group (created by the owner; the bot must be an admin there)
  const ch = await tg("getChat", { chat_id: chatFromLink(p.links.telegram) }).catch(() => null);
  if (ch?.linked_chat_id && s.tg_discussion?.chatId !== ch.linked_chat_id) {
    const me = await tg("getMe");
    const role = await tg("getChatMember", { chat_id: ch.linked_chat_id, user_id: me.id }).catch(() => null);
    await setSetting("tg_discussion", { chatId: ch.linked_chat_id, botAdmin: role?.status === "administrator", canDelete: Boolean(role?.can_delete_messages), since: new Date().toISOString() });
    await audit("publisher", "telegram.discussion_linked", "ok", { detail: { chatId: ch.linked_chat_id, role: role?.status ?? null } });
    if (role?.status !== "administrator" || !role.can_delete_messages) await alert("warn", "tg_discussion_rights", "Make the bot an admin of the comments group with 'Delete messages' so it can remove scam replies.");
  }
  if (s.platforms.telegram) return { discussion: Boolean(ch?.linked_chat_id) };
  const me = await tg("getMe");
  const m = await tg("getChatMember", { chat_id: chatFromLink(p.links.telegram), user_id: me.id }).catch(() => null);
  if (m?.status !== "administrator" || !m.can_post_messages) return { admin: false };
  await setSetting("platforms", { ...s.platforms, telegram: true });
  await audit("publisher", "telegram.platform_enabled", "ok", { detail: { canEdit: Boolean(m.can_edit_messages) } });
  if (!m.can_edit_messages) await alert("warn", "tg_pin_right", "The bot can post but not pin: give it 'Edit messages' in the channel admin rights.");
  return { admin: true };
}

// Telegram channel size (free, official) — a format signal, never published as social proof.
async function telegramMembers() {
  const p = project();
  if (!integrations().telegram || !p.links.telegram) return { skipped: true };
  const n = await tg("getChatMemberCount", { chat_id: chatFromLink(p.links.telegram) });
  await gauge("tg_members", n);
  return { members: n };
}

// X mentions → interactions. A mention that asks for a receipt becomes a REVIEW reply with the receipt image
// (the person opted in by mentioning us; one reply per mention; the owner approves every AI-free reply too).
const RECEIPT_ASK = /\breceipt\b[\s:,.-]*(?:for|this|pls|please)?[\s:,.-]*(.*)$/is;
async function xMentions() {
  if (!(await xReady())) return { skipped: "x not connected" };
  const since = (await getSetting("x_mentions_since"))?.id ?? null;
  const res = await mentions(since);
  const rows = res?.data ?? [];
  if (!rows.length) return { new: 0 };
  const prices = (await getSetting("prices")) || {};
  await recordCost("x_api", rows.length, "posts read", rows.length * (prices.xReadUsd ?? 0.005), "mentions");
  const users = Object.fromEntries((res.includes?.users || []).map((u) => [u.id, u.username]));
  const sql = await db();
  let asks = 0;
  for (const t of rows) {
    const author = users[t.author_id] ?? null;
    const url = author ? `https://x.com/${author}/status/${t.id}` : null;
    const inserted = await sql`insert into chek.interactions (id, platform, kind, author, author_id, text, url, at, data)
      values (${`x-${t.id}`}, 'x', 'mention', ${author}, ${t.author_id}, ${t.text}, ${url}, ${t.created_at ?? null}, ${sql.json({ refs: t.referenced_tweets ?? [] })})
      on conflict (id) do nothing returning id`;
    if (!inserted.length || !author) continue;
    const clean = t.text.replace(/(^|\s)@\w+/g, " ").trim();
    const ask = RECEIPT_ASK.exec(clean);
    const claim = ask ? checkClaim({ claim: ask[1] || clean }) : null;
    if (!claim?.ok) continue;
    await enqueue({
      id: `reply-${t.id}`,
      platform: "x",
      category: "community",
      level: "review",
      origin: "community",
      payload: {
        parts: [`receipt printed 🧾`],
        imageUrl: `/api/image?${new URLSearchParams({ claim: claim.claim, stamp: claim.stamp, format: "square" })}`,
        replyTo: t.id,
        allowMentions: [author],
        why: `@${author} asked for a receipt: ${url}`,
      },
      publishAfter: new Date().toISOString(),
    });
    await sql`update chek.interactions set status = 'queued' where id = ${`x-${t.id}`}`;
    asks++;
  }
  await setSetting("x_mentions_since", { id: res.meta?.newest_id ?? rows[0].id });
  return { new: rows.length, asks };
}

// Tells the owner once when the dry run is over (the report is generated from the dashboard / by Claude).
async function dryWatch() {
  const s = await allSettings();
  const d = s.dry_run;
  if (!d?.endsAt || d.reported || Date.parse(d.endsAt) > Date.now()) return { skipped: true };
  const sql = await db();
  const counts = await sql`select verdict, count(*)::int as n from chek.dry_log where run = ${d.id} group by verdict`;
  const c = Object.fromEntries(counts.map((r) => [r.verdict, r.n]));
  await notifyOwner(s.owner?.telegramUserId, `🧾 Dry run ${d.id} finished.\nwould publish: ${c.would_publish ?? 0} · rejected: ${c.rejected ?? 0} · review: ${c.review ?? 0} · expired: ${c.expired ?? 0}\nNothing was published. The full report is ready.`).catch(() => null);
  await setSetting("dry_run", { ...d, reported: new Date().toISOString() });
  return c;
}

const JOBS = [
  { name: "tg_rights", everyMin: 30, run: telegramRights },
  { name: "ai_expire", everyMin: 15, run: expireJobs },
  { name: "x_handoff_expire", everyMin: 15, run: expireHandoffs },
  { name: "drop_draws", everyMin: 5, run: runRoundDraws },
  { name: "inbox_send", everyMin: 0, run: sendPendingReplies },
  { name: "publisher", everyMin: 0, run: runPublisher },
  { name: "onchain", everyMin: 5, run: runWatcher },
  // news desk is off unless settings.news.enabled (owner: no general crypto/Solana news on CHEK channels)
  { name: "news_fetch", everyMin: 120, run: async () => ((await getSetting("news"))?.enabled ? fetchFeeds() : { skipped: "news off" }) },
  { name: "news_eval", everyMin: 240, offsetMin: 10, run: async () => ((await getSetting("news"))?.enabled ? evaluateNews(2) : { skipped: "news off" }) },
  { name: "x_mentions", everyMin: 15, run: xMentions },
  { name: "prod_audit", everyMin: 360, run: runProdAudit },
  { name: "dry_watch", everyMin: 10, run: dryWatch },
  { name: "engine", daily: "morning", run: runEngine },
  { name: "digest", daily: "15:30", run: digest }, // 20:30 in Almaty
  { name: "tg_members", daily: "23:50", run: telegramMembers },
  { name: "fixed_costs", daily: "00:05", run: fixedCosts },
];

function dueDaily(last, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
  return now >= at && (!last || new Date(last) < at);
}

async function runOne(job, runs) {
  const t0 = Date.now();
  let out;
  try {
    out = await job.run();
  } catch (e) {
    out = { error: e.message };
    await audit(job.name, "job.failed", "error", { error: e.message });
    await alert("error", `job_${job.name}`, `${job.name} failed: ${e.message}`);
  }
  runs[job.name] = new Date().toISOString(); // a failing job is not hammered every tick
  return { ...(out && typeof out === "object" ? out : { value: out }), ms: Date.now() - t0 };
}

export async function tick() {
  const settings = await allSettings();
  if (settings.autopilot === "off") return { autopilot: "off" };
  const runs = (await getSetting("job_runs")) || {};
  const cadence = settings.cadence;
  const result = {};
  for (const job of JOBS) {
    const last = runs[job.name];
    let due;
    if (job.daily) {
      // a job that never ran (fresh start / dry run) runs on the first tick
      const hhmm = job.daily === "morning" ? shift(cadence.morning, -60) : job.daily === "digest" ? shift(cadence.evening, 120) : job.daily;
      due = !last || dueDaily(last, hhmm);
    } else {
      due = !last || Date.now() - new Date(last).getTime() >= (job.everyMin + (job.offsetMin && !last ? job.offsetMin : 0)) * 60e3 - 30e3;
    }
    if (due) result[job.name] = await runOne(job, runs);
  }
  runs.tick = new Date().toISOString();
  await setSetting("job_runs", runs);
  return result;
}

export async function runJob(name) {
  const job = JOBS.find((j) => j.name === name);
  if (!job) throw new Error(`unknown job ${name}`);
  const runs = (await getSetting("job_runs")) || {};
  const out = await runOne(job, runs);
  await setSetting("job_runs", runs);
  return { ok: true, [name]: out };
}

// Supabase pg_cron + pg_net call /api/cron every N minutes (Vercel Hobby cron is daily only). Idempotent.
export async function cronSetup(everyMin = 5) {
  if (!env.cronSecret) throw new Error("CRON_SECRET not set");
  const sql = await db();
  const url = `${env.siteUrl.replace(/\/$/, "")}/api/cron`;
  await sql.unsafe("create extension if not exists pg_cron");
  await sql.unsafe("create extension if not exists pg_net with schema extensions");
  await sql`select cron.unschedule(jobid) from cron.job where jobname = 'chek-tick'`;
  const headers = JSON.stringify({ "content-type": "application/json", "x-cron-secret": env.cronSecret });
  const command = `select net.http_post(url := '${url}', headers := '${headers}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 280000)`;
  const [row] = await sql`select cron.schedule('chek-tick', ${`*/${everyMin} * * * *`}, ${command}) as id`;
  await audit("owner", "cron.scheduled", "ok", { detail: { everyMin, url } });
  return { ok: true, jobId: Number(row.id), everyMin, url };
}

function shift(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// Fixed monthly costs (hosting/db plans) recorded as a daily share, so COSTS shows the full picture.
async function fixedCosts() {
  const fixed = (await getSetting("fixed_costs")) || { hosting: 0, database: 0 };
  for (const [provider, monthly] of Object.entries(fixed)) if (monthly > 0) await recordCost(provider, 1, "day", monthly / 30, "plan");
  return fixed;
}

// Evening digest to the owner's Telegram: what happened, what waits for them, what it cost.
async function digest() {
  const s = await allSettings();
  const owner = s.owner?.telegramUserId;
  if (!owner) return { skipped: "owner not linked" };
  const sql = await db();
  const [m] = await sql`select
    (select count(*) from chek.queue where status='published' and published_at > now() - interval '24 hours')::int as posts,
    (select count(*) from chek.queue where status='dry_published' and dry_at > now() - interval '24 hours')::int as dry,
    (select count(*) from chek.queue where status='review')::int as review,
    (select count(*) from chek.receipts where created_at > now() - interval '24 hours')::int as receipts,
    (select count(*) from chek.alerts where resolved_at is null)::int as alerts,
    (select count(*) from chek.news_items where checked_at > now() - interval '24 hours')::int as news,
    (select count(*) from chek.interactions where created_at > now() - interval '24 hours')::int as interactions,
    (select coalesce(sum(value),0)::int from chek.metrics where day = current_date and key in ('rg_gen','tg_receipts')) as printed`;
  const cost = await spend(1);
  await notifyOwner(owner, `🧾 CHEK daily\nposts: ${m.posts}${s.autopilot === "dry" ? ` (dry run: ${m.dry} would have gone out)` : ""} · receipts: ${m.receipts} · news checked: ${m.news}\nreceipts printed by people today: ${m.printed} · mentions/submissions: ${m.interactions}\nwaiting for you: ${m.review} review · ${m.alerts} alerts\nspend 24h: $${cost.toFixed(2)}\nautopilot: ${s.autopilot}`);
  return m;
}
