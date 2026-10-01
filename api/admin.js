// Owner command center API. Auth: ADMIN_TOKEN (bearer) — used by the local dashboard only.
import { randomBytes } from "node:crypto";
import { allSettings, audit, getSetting, setSetting, spend } from "../server/lib/core.js";
import { db } from "../server/lib/db.js";
import { env, integrations } from "../server/lib/env.js";
import { AppError, handle, json, readJson, requireAdmin, sign } from "../server/lib/http.js";
import { tick } from "../server/lib/jobs.js";
import { decide } from "../server/lib/publisher.js";
import { reschedule, syncSeed } from "../server/lib/queue.js";
import { syncBuildLog } from "../server/lib/receipts.js";
import { tg } from "../server/lib/telegram.js";
import { xAccount } from "../server/lib/x.js";

export const maxDuration = 120;

const PROVIDERS = ["x_api", "ai_api", "rpc", "hosting", "database", "images", "other"];

async function status() {
  const sql = await db();
  const s = await allSettings();
  const [counts] = await sql`select
    (select count(*) from chek.queue where status = 'published' and published_at > current_date)::int as posts_today,
    (select count(*) from chek.receipts where created_at > current_date)::int as receipts_today,
    (select count(*) from chek.news_items where checked_at > current_date)::int as news_reviewed_today,
    (select count(*) from chek.receipts)::int as receipts_total,
    (select count(*) from chek.queue where status = 'review')::int as review`;
  const metrics = await sql`select key, value::float from chek.metrics where day = current_date`;
  const queue = await sql`select id, platform, category, level, status, slot, publish_after, origin, last_error, external_url, requires,
      left(payload->'parts'->>0, 280) as preview
    from chek.queue where status in ('ready','review','approved','failed','publishing') order by publish_after nulls last limit 40`;
  const alerts = await sql`select id, at, level, kind, message, ref from chek.alerts where resolved_at is null order by at desc limit 30`;
  const auditLog = await sql`select at, agent, action, result, ref, source, error from chek.audit_log order by at desc limit 80`;
  const costs = {};
  for (const d of [1, 7, 30]) costs[d] = Object.fromEntries(await Promise.all(PROVIDERS.map(async (p) => [p, await spend(d, p)])));
  const x = await xAccount().catch(() => null);
  return {
    integrations: integrations(),
    settings: { ...s, owner: { linked: Boolean(s.owner?.telegramUserId) }, owner_claim: undefined },
    xAccount: x ? { username: x.username } : null,
    counts,
    metrics: Object.fromEntries(metrics.map((m) => [m.key, m.value])),
    queue,
    alerts,
    audit: auditLog,
    costs,
  };
}

const ALLOWED = {
  autopilot: (v) => ["off", "dry", "on"].includes(v),
  platforms: (v) => typeof v === "object" && ["x", "telegram"].every((k) => typeof v[k] === "boolean"),
  budgets: (v) => ["dailyUsd", "monthlyUsd", "aiDailyUsd"].every((k) => typeof v[k] === "number" && v[k] >= 0 && v[k] < 1000),
  limits: (v) => ["xPerDay", "telegramPerDay", "minGapMinutes"].every((k) => Number.isInteger(v[k]) && v[k] >= 0 && v[k] <= 100),
  cadence: (v) => ["morning", "day", "evening"].every((k) => /^\d{2}:\d{2}$/.test(v[k])),
  fixed_costs: (v) => Object.values(v).every((n) => typeof n === "number" && n >= 0),
  ai: (v) => ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"].includes(v.model),
  prices: (v) => Object.values(v).every((n) => typeof n === "number" && n >= 0),
  onchain_threshold_pct: (v) => typeof v === "number" && v > 0 && v < 100,
};

export async function GET(request) {
  return handle(async () => {
    requireAdmin(request);
    return json(await status());
  });
}

export async function POST(request) {
  return handle(async () => {
    requireAdmin(request);
    const b = await readJson(request);
    switch (b.op) {
      case "settings": {
        for (const [k, v] of Object.entries(b.values || {})) {
          if (!ALLOWED[k]?.(v)) throw new AppError(400, `bad setting ${k}`);
          await setSetting(k, v);
          await audit("owner", `settings.${k}`, "ok", { detail: { value: v } });
        }
        return json({ ok: true });
      }
      case "schedule": {
        const s = await getSetting("schedule");
        if (b.d1 && !/^\d{4}-\d{2}-\d{2}$/.test(b.d1)) throw new AppError(400, "bad d1");
        if (b.launchAt && Number.isNaN(Date.parse(b.launchAt))) throw new AppError(400, "bad launchAt");
        await setSetting("schedule", { ...s, ...(b.d1 ? { d1: b.d1 } : {}), ...(b.launchAt !== undefined ? { launchAt: b.launchAt ? new Date(b.launchAt).toISOString() : null } : {}) });
        return json({ ok: true, rescheduled: await reschedule() });
      }
      case "decide":
        return json({ ok: true, row: await decide(String(b.id), Boolean(b.approve), "dashboard") });
      case "sync":
        return json({ ok: true, seed: await syncSeed(), receipts: await syncBuildLog() });
      case "input": {
        if (!/^[A-Z_]{2,30}$/.test(b.key || "")) throw new AppError(400, "bad key");
        const inputs = (await getSetting("inputs")) || {};
        inputs[b.key] = String(b.value).slice(0, 100);
        await setSetting("inputs", inputs);
        return json({ ok: true });
      }
      case "resolve_alert": {
        const sql = await db();
        await sql`update chek.alerts set resolved_at = now() where id = ${Number(b.id)}`;
        return json({ ok: true });
      }
      case "run":
        return json({ ok: true, result: await tick() });
      case "telegram_setup": {
        if (!integrations().telegram) throw new AppError(400, "TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET not set");
        const me = await tg("getMe");
        await tg("setWebhook", { url: `${env.siteUrl}/api/telegram`, secret_token: env.telegramWebhookSecret, allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"], drop_pending_updates: true });
        const code = randomBytes(4).toString("hex");
        await setSetting("owner_claim", { code, expiresAt: Date.now() + 3600e3 });
        await audit("owner", "telegram.webhook_set", "ok", { detail: { bot: me.username } });
        return json({ ok: true, bot: me.username, claim: `/start ${code}` });
      }
      case "x_connect_link": {
        if (!integrations().x) throw new AppError(400, "X_CLIENT_ID / X_CLIENT_SECRET not set");
        const exp = String(Date.now() + 15 * 60e3);
        return json({ ok: true, url: `${env.siteUrl}/api/x?op=connect&e=${exp}&s=${sign(`xconnect:${exp}`)}` });
      }
      default:
        throw new AppError(400, "unknown op");
    }
  });
}
