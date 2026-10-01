// SCHEDULER: one entry point called every few minutes (pg_cron → /api/cron). Each job has its own frequency,
// tracked in settings, so the tick interval can change without changing behaviour.
import { alert, allSettings, audit, getSetting, recordCost, setSetting, spend } from "./core.js";
import { db } from "./db.js";
import { runEngine } from "./engine.js";
import { evaluateNews, fetchFeeds } from "./news.js";
import { runWatcher } from "./onchain.js";
import { runPublisher } from "./publisher.js";
import { chatFromLink, notifyOwner, tg } from "./telegram.js";
import { integrations } from "./env.js";
import { project } from "./project.js";

// Telegram turns itself on once the owner made the bot an admin of the channel (post + edit/pin rights).
async function telegramRights() {
  const s = await allSettings();
  const p = project();
  if (!integrations().telegram || !p.links.telegram || s.platforms.telegram) return { skipped: true };
  const me = await tg("getMe");
  const m = await tg("getChatMember", { chat_id: chatFromLink(p.links.telegram), user_id: me.id }).catch(() => null);
  if (m?.status !== "administrator" || !m.can_post_messages) return { admin: false };
  await setSetting("platforms", { ...s.platforms, telegram: true });
  await audit("publisher", "telegram.platform_enabled", "ok", { detail: { canEdit: Boolean(m.can_edit_messages) } });
  if (!m.can_edit_messages) await alert("warn", "tg_pin_right", "The bot can post but not pin: give it 'Edit messages' in the channel admin rights.");
  return { admin: true };
}

const JOBS = [
  { name: "tg_rights", everyMin: 30, run: telegramRights },
  { name: "publisher", everyMin: 0, run: runPublisher },
  { name: "onchain", everyMin: 5, run: runWatcher },
  { name: "news_fetch", everyMin: 120, run: fetchFeeds },
  { name: "news_eval", everyMin: 240, offsetMin: 10, run: () => evaluateNews(2) },
  { name: "engine", daily: "morning", run: runEngine },
  { name: "digest", daily: "digest", run: digest },
  { name: "fixed_costs", daily: "00:05", run: fixedCosts },
];

function dueDaily(last, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
  return now >= at && (!last || new Date(last) < at);
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
      const hhmm = job.daily === "morning" ? shift(cadence.morning, -60) : job.daily === "digest" ? shift(cadence.evening, 120) : job.daily;
      due = dueDaily(last, hhmm);
    } else {
      due = !last || Date.now() - new Date(last).getTime() >= (job.everyMin + (job.offsetMin && !last ? job.offsetMin : 0)) * 60e3 - 30e3;
    }
    if (!due) continue;
    const t0 = Date.now();
    try {
      result[job.name] = await job.run();
      runs[job.name] = new Date().toISOString();
    } catch (e) {
      result[job.name] = { error: e.message };
      await audit(job.name, "job.failed", "error", { error: e.message });
      await alert("error", `job_${job.name}`, `${job.name} failed: ${e.message}`);
      runs[job.name] = new Date().toISOString(); // don't hammer a failing job every tick
    }
    result[job.name] = { ...(typeof result[job.name] === "object" ? result[job.name] : { value: result[job.name] }), ms: Date.now() - t0 };
  }
  runs.tick = new Date().toISOString();
  await setSetting("job_runs", runs);
  return result;
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
    (select count(*) from chek.queue where status='review')::int as review,
    (select count(*) from chek.receipts where created_at > now() - interval '24 hours')::int as receipts,
    (select count(*) from chek.alerts where resolved_at is null)::int as alerts,
    (select count(*) from chek.news_items where checked_at > now() - interval '24 hours')::int as news`;
  const cost = await spend(1);
  await notifyOwner(owner, `🧾 CHEK daily\nposts: ${m.posts} · receipts: ${m.receipts} · news checked: ${m.news}\nwaiting for you: ${m.review} review · ${m.alerts} alerts\nspend 24h: $${cost.toFixed(2)}\nautopilot: ${s.autopilot}`);
  return m;
}
