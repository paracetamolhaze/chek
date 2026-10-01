// Telegram webhook (@chekcoinsol_bot). Every request must carry the secret_token set via setWebhook.
//  · anyone, in a private chat: send a claim → the bot prints it as a CHEK receipt (same generator as /print).
//    The bot only ever answers people who wrote to it first. Opt-in buttons let the author offer the receipt for the
//    channel (with credit or anonymously) — that goes to the owner's REVIEW queue, never straight to the channel.
//  · the owner: one-tap approvals (✅/❌), /status /queue /pause /dry /live
import { checkClaim, claimCode, claimQuery } from "../shared/claim.mjs";
import { allSettings, audit, bump, getSetting, setSetting } from "../server/lib/core.js";
import { db } from "../server/lib/db.js";
import { env } from "../server/lib/env.js";
import { json, safeEqual } from "../server/lib/http.js";
import { project } from "../server/lib/project.js";
import { decide } from "../server/lib/publisher.js";
import { enqueue } from "../server/lib/queue.js";
import { renderClaimReceipt } from "../server/lib/render.js";
import { tg } from "../server/lib/telegram.js";

export const maxDuration = 60;

const reply = (chat, text, extra = {}) => tg("sendMessage", { chat_id: chat, text, link_preview_options: { is_disabled: true }, ...extra });
const PER_HOUR = 8;

function welcome() {
  const p = project();
  return `🧾 I print receipts.\n\nSend me any claim — “partnership soon”, “just one more trade”, anything — and I'll print it as a ${p.name} receipt you can share.\n\nOptional: add a stamp on a new line — VOID, PROOF PENDING or NO RECEIPT.\n\nI never ask for wallets, keys or seed phrases. Official links: ${p.links.website}`;
}

async function printReceipt(m) {
  const sql = await db();
  const [{ n }] = await sql`select count(*)::int as n from chek.interactions where platform = 'telegram' and author_id = ${String(m.from.id)} and created_at > now() - interval '1 hour'`;
  if (n >= PER_HOUR) return reply(m.chat.id, "That's a lot of receipts for one hour. The printer needs a minute — try again later.");
  const [first, ...rest] = m.text.replace(/^\/receipt(@\w+)?\s*/i, "").trim().split("\n");
  const stamp = rest.join(" ").trim() || undefined;
  const c = checkClaim({ claim: first, stamp });
  if (!c.ok) return reply(m.chat.id, `Can't print that: ${c.problems.join(" ")}\n\nNo links, wallet addresses, @handles or $cashtags.`);
  const png = await renderClaimReceipt({ claim: c.claim, stamp: c.stamp, format: "square" });
  const site = project().links.website.replace(/\/$/, "");
  const share = `${site}/r?${claimQuery({ claim: c.claim, stamp: c.stamp })}`;
  const intent = `https://x.com/intent/post?${new URLSearchParams({ text: `receipt printed 🧾 “${c.claim}”`, url: share, via: project().accounts?.x?.handle ?? "chekcoinsol" })}`;
  const id = `tg-${m.chat.id}-${m.message_id}`;
  const form = new FormData();
  form.set("chat_id", String(m.chat.id));
  form.set("caption", `RECEIPT ${claimCode(c.claim)} · ${c.stamp}\nprinted by you · not a statement by ${project().name}`);
  form.set("photo", new Blob([png], { type: "image/png" }), "receipt.png");
  form.set(
    "reply_markup",
    JSON.stringify({
      inline_keyboard: [
        [{ text: "Share on X", url: intent }],
        [
          { text: "Offer for the channel (credit me)", callback_data: `fc:${m.message_id}:c` },
          { text: "…anonymously", callback_data: `fc:${m.message_id}:a` },
        ],
      ],
    }),
  );
  await tg("sendPhoto", form);
  await sql`insert into chek.interactions (id, platform, kind, author, author_id, text, at, data)
    values (${id}, 'telegram', 'submission', ${m.from.username ?? null}, ${String(m.from.id)}, ${c.claim}, now(), ${sql.json({ stamp: c.stamp, share })})
    on conflict (id) do nothing`;
  await bump("tg_receipts");
}

// The author offered their receipt for the channel → owner REVIEW (credit only if they asked for it and have a username).
async function offer(q) {
  const [, msgId, mode] = q.data.split(":");
  const sql = await db();
  const id = `tg-${q.message.chat.id}-${msgId}`;
  const [it] = await sql`update chek.interactions set consent = ${mode === "c" ? "credit" : "anonymous"}, status = 'candidate'
    where id = ${id} and author_id = ${String(q.from.id)} and status = 'new' returning *`;
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: it ? "Thanks — the owner reviews every submission before anything is posted." : "Already offered." });
  if (!it) return;
  const credit = mode === "c" && it.author ? `by @${it.author}` : "by a reader";
  await enqueue({
    id: `sub-${it.id}`,
    platform: "telegram",
    category: "community",
    level: "review",
    origin: "community",
    payload: {
      parts: [`receipt from the community 🧾 ${credit}\n\nprint yours: write to @${(project().accounts?.telegram?.bot ?? "chekcoinsol_bot")} or ${project().links.website.replace(/^https?:\/\//, "")}/print`],
      imageUrl: `/api/image?${claimQuery({ claim: it.text, stamp: it.data?.stamp }, { short: false })}&format=square`,
      why: `submitted in the bot (${mode === "c" ? "credit requested" : "anonymous"})`,
    },
    publishAfter: new Date().toISOString(),
  });
  await sql`update chek.interactions set status = 'queued' where id = ${id}`;
}

export async function POST(request) {
  if (!safeEqual(request.headers.get("x-telegram-bot-api-secret-token"), env.telegramWebhookSecret)) return json({ ok: false }, 401);
  const u = await request.json().catch(() => ({}));
  try {
    const s = await allSettings();
    const owner = s.owner?.telegramUserId;

    if (u.callback_query) {
      const q = u.callback_query;
      if (String(q.data || "").startsWith("fc:")) {
        await offer(q);
        return json({ ok: true });
      }
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

    if (cmd === "/start") {
      const claim = await getSetting("owner_claim");
      if (arg && !owner && claim && claim.code === arg && Date.now() < claim.expiresAt) {
        await setSetting("owner", { telegramUserId: m.from.id });
        await setSetting("owner_claim", null);
        await audit("owner", "telegram.owner_linked", "ok", { detail: { id: m.from.id } });
        await reply(m.chat.id, "🧾 Linked. You'll get approvals, alerts and a daily digest here.\nCommands: /status /queue /pause /dry /live\nAnything else you send is printed as a receipt.");
      } else await reply(m.chat.id, welcome());
      return json({ ok: true });
    }

    const isOwner = owner && m.from.id === owner;
    if (isOwner && cmd === "/status") {
      const sql = await db();
      const [c] = await sql`select (select count(*) from chek.queue where status='review')::int as review, (select count(*) from chek.alerts where resolved_at is null)::int as alerts`;
      await reply(m.chat.id, `autopilot: ${s.autopilot}${s.dry_run?.endsAt ? ` (dry run until ${s.dry_run.endsAt.slice(0, 16)}Z)` : ""}\nX: ${s.platforms.x ? "on" : "off"} · Telegram: ${s.platforms.telegram ? "on" : "off"}\nreview: ${c.review} · alerts: ${c.alerts}`);
    } else if (isOwner && cmd === "/queue") {
      const sql = await db();
      const rows = await sql`select id, platform, status, publish_after from chek.queue where status in ('ready','review','approved') order by publish_after nulls last limit 8`;
      await reply(m.chat.id, rows.map((r) => `${r.id} · ${r.platform} · ${r.status} · ${r.publish_after ? new Date(r.publish_after).toISOString().slice(5, 16) : "—"}`).join("\n") || "empty");
    } else if (isOwner && ["/pause", "/dry", "/live"].includes(cmd)) {
      const mode = { "/pause": "off", "/dry": "dry", "/live": "on" }[cmd];
      if (mode === "on") {
        const { liveGate } = await import("../server/lib/dryrun.js");
        const gate = await liveGate(s);
        if (!gate.ok) {
          await reply(m.chat.id, `not going live yet:\n• ${gate.missing.join("\n• ")}`);
          return json({ ok: true });
        }
      }
      await setSetting("autopilot", mode);
      await audit("owner", "autopilot.set", "ok", { detail: { mode, via: "telegram" } });
      await reply(m.chat.id, `autopilot → ${mode}`);
    } else if (cmd === "/help") {
      await reply(m.chat.id, welcome());
    } else if (!cmd.startsWith("/") || cmd.startsWith("/receipt")) {
      await printReceipt(m);
    }
  } catch (e) {
    await audit("telegram", "webhook.error", "error", { error: e.message });
  }
  return json({ ok: true });
}
