// Telegram webhook: owner commands and one-tap approvals. Every request must carry the secret_token set via setWebhook.
import { allSettings, audit, getSetting, setSetting } from "../server/lib/core.js";
import { db } from "../server/lib/db.js";
import { env } from "../server/lib/env.js";
import { json, safeEqual } from "../server/lib/http.js";
import { decide } from "../server/lib/publisher.js";
import { tg } from "../server/lib/telegram.js";

const reply = (chat, text) => tg("sendMessage", { chat_id: chat, text, link_preview_options: { is_disabled: true } });

export async function POST(request) {
  if (!safeEqual(request.headers.get("x-telegram-bot-api-secret-token"), env.telegramWebhookSecret)) return json({ ok: false }, 401);
  const u = await request.json().catch(() => ({}));
  try {
    const s = await allSettings();
    const owner = s.owner?.telegramUserId;

    if (u.callback_query) {
      const q = u.callback_query;
      if (!owner || q.from.id !== owner) return json({ ok: true });
      const [act, id] = String(q.data || "").split(":");
      const row = await decide(id, act === "ap", "telegram");
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: row ? (act === "ap" ? "Approved — goes out on the next tick" : "Rejected") : "Already handled" });
      if (q.message) await tg("editMessageReplyMarkup", { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
      return json({ ok: true });
    }

    const m = u.message;
    if (!m || m.chat.type !== "private" || !m.text) return json({ ok: true });
    const [cmd, arg] = m.text.trim().split(/\s+/, 2);

    if (cmd === "/start" && arg) {
      const claim = await getSetting("owner_claim");
      if (!owner && claim && claim.code === arg && Date.now() < claim.expiresAt) {
        await setSetting("owner", { telegramUserId: m.from.id });
        await setSetting("owner_claim", null);
        await audit("owner", "telegram.owner_linked", "ok", { detail: { id: m.from.id } });
        await reply(m.chat.id, "🧾 Linked. You'll get approvals, alerts and a daily digest here.\nCommands: /status /queue /pause /dry /live");
      }
      return json({ ok: true });
    }
    if (!owner || m.from.id !== owner) return json({ ok: true }); // the bot ignores everyone else in private

    if (cmd === "/status") {
      const sql = await db();
      const [c] = await sql`select (select count(*) from chek.queue where status='review')::int as review, (select count(*) from chek.alerts where resolved_at is null)::int as alerts`;
      await reply(m.chat.id, `autopilot: ${s.autopilot}\nX: ${s.platforms.x ? "on" : "off"} · Telegram: ${s.platforms.telegram ? "on" : "off"}\nreview: ${c.review} · alerts: ${c.alerts}`);
    } else if (cmd === "/queue") {
      const sql = await db();
      const rows = await sql`select id, platform, status, publish_after from chek.queue where status in ('ready','review','approved') order by publish_after nulls last limit 8`;
      await reply(m.chat.id, rows.map((r) => `${r.id} · ${r.platform} · ${r.status} · ${r.publish_after ? new Date(r.publish_after).toISOString().slice(5, 16) : "—"}`).join("\n") || "empty");
    } else if (["/pause", "/dry", "/live"].includes(cmd)) {
      const mode = { "/pause": "off", "/dry": "dry", "/live": "on" }[cmd];
      await setSetting("autopilot", mode);
      await audit("owner", "autopilot.set", "ok", { detail: { mode, via: "telegram" } });
      await reply(m.chat.id, `autopilot → ${mode}`);
    }
  } catch (e) {
    await audit("telegram", "webhook.error", "error", { error: e.message });
  }
  return json({ ok: true });
}
