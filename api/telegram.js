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
import { attachLink, confirmPosted, openHandoff, skipHandoff, tweetIdOf } from "../server/lib/xhandoff.js";
import { dropClosed } from "../server/lib/xdrop.js";
import { isPubkey } from "../shared/solana-inspect.mjs";
import { chatFromLink } from "../server/lib/telegram.js";

export const maxDuration = 60;

const reply = (chat, text, extra = {}) => tg("sendMessage", { chat_id: chat, text, link_preview_options: { is_disabled: true }, ...extra });
const PER_HOUR = 8;

function welcome() {
  const p = project();
  const drop = p.drop?.status === "open" ? `\n\n🎁 Telegram drop: send /drop and your public Solana address to enter (subscribe to ${p.links.telegram.replace("https://", "")} first). The main drop runs on X: ${p.links.website}/drop` : "";
  return `🧾 I print receipts.\n\nSend me any claim — “partnership soon”, “just one more trade”, anything — and I'll print it as a ${p.name} receipt you can share.\n\nOptional: add a stamp on a new line — VOID, PROOF PENDING or NO RECEIPT.${drop}\n\nI never ask for seed phrases, private keys, signatures or fees. Official links: ${p.links.website}`;
}

// Receipt Drop entry: a public address only, one per Telegram account, channel subscribers only.
// Returns { ok, n } or { error } — the caller answers (private chat: a message; comments: a reaction).
async function registerDrop(userId, wallet) {
  const p = project();
  if (!p.drop?.telegram || (await dropClosed(p))) return { error: "closed" };
  if (!isPubkey(wallet)) return { error: "invalid" };
  const member = await tg("getChatMember", { chat_id: chatFromLink(p.links.telegram), user_id: userId }).catch(() => null);
  if (!["member", "administrator", "creator"].includes(member?.status)) return { error: "not_subscribed" };
  const sql = await db();
  const [mine] = await sql`select wallet from chek.drop_entries where tg_user_id = ${userId}`;
  if (mine) return { error: "already", wallet: mine.wallet };
  const [taken] = await sql`select 1 from chek.drop_entries where wallet = ${wallet}`;
  if (taken) return { error: "taken" };
  await sql`insert into chek.drop_entries (tg_user_id, wallet) values (${userId}, ${wallet}) on conflict do nothing`;
  const [{ n }] = await sql`select count(*)::int as n from chek.drop_entries`;
  await bump("drop_entries");
  return { ok: true, n };
}

// Terms of the Telegram drop (the X drop is separate: reply on X + the link at /drop).
function dropTerms(p) {
  const d = p.drop.telegram;
  const t = `$${p.ticker}`;
  const n = (v) => v.toLocaleString("en-US");
  return `Telegram drop — airdrop: the first ${n(d.airdrop.wallets)} valid entries get ${n(d.airdrop.each)} ${t} each. Draw: ${n(d.draw.winners)} random wallets × ${n(d.draw.each)} ${t}. All from the creator's own launch buy, sent within 48 h after the draw (24 h after launch), only if ${t} launches.\n\nThe main drop runs on X with its own list: reply to a drop post on X with your address, then paste the link at ${p.links.website}/drop. You can enter both.`;
}

async function enterDrop(m, wallet) {
  const p = project();
  const r = await registerDrop(m.from.id, wallet);
  if (r.error === "closed") return reply(m.chat.id, "The drop isn't open right now. Official news only in the channel and on the site.");
  if (r.error === "invalid") return reply(m.chat.id, "That isn't a valid Solana address. Send /drop followed by your public address (never a seed phrase or private key).");
  if (r.error === "not_subscribed") return reply(m.chat.id, `Subscribe to the channel first: ${p.links.telegram}\nThen send /drop ${wallet} again.`);
  if (r.error === "already") return reply(m.chat.id, `You're already in with ${r.wallet.slice(0, 4)}…${r.wallet.slice(-4)}. One address per Telegram account.`);
  if (r.error === "taken") return reply(m.chat.id, "This address is already entered.");
  return reply(
    m.chat.id,
    `✅ You're in — entry #${r.n}.\n\n${dropTerms(p)}\n\nTokens are SENT. We never DM first, never ask you to connect a wallet, sign anything or pay a fee — anything like that is a scam.\n\nRules: ${p.links.website}/drop`,
  );
}

// Discussion group of the channel (comments). Two jobs only:
//  1. a comment with a Solana address enters the drop → the bot reacts 👍 (already in: 👌; not subscribed: a short hint);
//  2. scam bait from non-admins (links, "claim", "connect wallet", "DM me", seed-phrase talk) is deleted — drop threads attract it.
const SCAM = /(https?:\/\/|t\.me\/(?!chekcoinsol\b)|www\.|\bclaim\b|connect (?:your )?wallet|validate|sync wallet|seed phrase|private key|\bdm me\b|inbox me|write me)/i;
async function groupMessage(m, s) {
  const linked = s.tg_discussion?.chatId;
  if (!linked || m.chat.id !== linked || !m.from || m.from.is_bot || m.sender_chat) return;
  const text = m.text || m.caption || "";
  const admin = await tg("getChatMember", { chat_id: m.chat.id, user_id: m.from.id })
    .then((x) => ["administrator", "creator"].includes(x.status))
    .catch(() => false);
  if (!admin && SCAM.test(text)) {
    await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id }).catch(() => {});
    await bump("tg_scam_deleted");
    return;
  }
  const wallet = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)?.[0];
  if (!wallet) return;
  const r = await registerDrop(m.from.id, wallet);
  const react = (emoji) => tg("setMessageReaction", { chat_id: m.chat.id, message_id: m.message_id, reaction: [{ type: "emoji", emoji }] }).catch(() => {});
  if (r.ok) return react("👍");
  if (r.error === "already" || r.error === "taken") return react("👌");
  if (r.error === "not_subscribed")
    return tg("sendMessage", { chat_id: m.chat.id, reply_parameters: { message_id: m.message_id }, text: "Subscribe to the channel first, then post your address again 🧾" }).catch(() => {});
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
      if (act === "xp" || act === "xs") {
        const done = act === "xp" ? await confirmPosted(id, null, owner) : { ok: await skipHandoff(id) };
        await tg("answerCallbackQuery", { callback_query_id: q.id, text: !done.ok ? "Already handled" : act === "xs" ? "Skipped" : done.published ? "Logged as posted ✅" : done.waitingForLink ? "Paste the post link here" : `Next: part ${done.next}` });
        // drop rounds: the channel links to the X post, so ask for its link once
        if (act === "xp" && done.published && /^xg-/.test(id)) await reply(q.from.id, `✅ ${id} logged. Paste its link here too — the Telegram channel points people to this round.`);
        if (q.message && (act === "xs" || done.published)) await tg("editMessageReplyMarkup", { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
        return json({ ok: true });
      }
      const row = await decide(id, act === "ap", "telegram");
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: row ? (act === "ap" ? "Approved — goes out on the next tick" : "Rejected") : "Already handled" });
      if (q.message) await tg("editMessageReplyMarkup", { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
      return json({ ok: true });
    }

    // channel joins/leaves: counted per day only (Telegram does not tell bots who subscribes to a channel or why; no names stored)
    if (u.chat_member && u.chat_member.chat?.type === "channel") {
      const was = u.chat_member.old_chat_member?.status;
      const now = u.chat_member.new_chat_member?.status;
      const inside = (s) => ["member", "administrator", "creator"].includes(s);
      if (!inside(was) && inside(now)) await bump(u.chat_member.invite_link ? "tg_joins_invite_link" : "tg_joins");
      if (inside(was) && !inside(now)) await bump("tg_leaves");
      return json({ ok: true });
    }

    const m = u.message;
    // comments under channel posts arrive from the linked discussion group
    if (m && (m.chat.type === "supergroup" || m.chat.type === "group")) {
      await groupMessage(m, s);
      return json({ ok: true });
    }
    if (!m || m.chat.type !== "private" || !m.text) return json({ ok: true });
    const [cmd, arg] = m.text.trim().split(/\s+/, 2);

    if (cmd === "/start") {
      const claim = await getSetting("owner_claim");
      if (arg && !owner && claim && claim.code === arg && Date.now() < claim.expiresAt) {
        await setSetting("owner", { telegramUserId: m.from.id });
        await setSetting("owner_claim", { used: new Date().toISOString() }); // one-time code is spent
        await audit("owner", "telegram.owner_linked", "ok", { detail: { id: m.from.id } });
        await reply(m.chat.id, "🧾 Linked. You'll get approvals, alerts and a daily digest here.\nCommands: /status /queue /pause /dry /live\nAnything else you send is printed as a receipt.");
      } else await reply(m.chat.id, welcome());
      return json({ ok: true });
    }

    const isOwner = owner && m.from.id === owner;
    // the owner pasted the link of an X post they just made → log it (and send the next thread part)
    if (isOwner && tweetIdOf(m.text)) {
      const id = await openHandoff();
      const done = id ? await confirmPosted(id, m.text.trim(), owner) : { ok: false };
      // ✅ was tapped first → the link still belongs to the post just logged
      const late = !id ? await attachLink(m.text.trim()) : null;
      await reply(
        m.chat.id,
        late ? `🔗 Link saved for ${late}.` : !done.ok ? "No X post is waiting for a link right now." : done.published ? `✅ ${id} logged as posted.` : `Got it — part ${done.next} is above.`,
      );
      return json({ ok: true });
    }
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
    } else if (cmd === "/drop" || (!cmd.startsWith("/") && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m.text.trim()))) {
      await enterDrop(m, (cmd === "/drop" ? arg || "" : m.text).trim());
    } else if (!cmd.startsWith("/") || cmd.startsWith("/receipt")) {
      await printReceipt(m);
    }
  } catch (e) {
    await audit("telegram", "webhook.error", "error", { error: e.message });
  }
  return json({ ok: true });
}
