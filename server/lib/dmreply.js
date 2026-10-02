// Live replies to messages sent to the channel: the AI reads the whole conversation with that person and answers
// like the founder would, short and human. Runs through the owner's PC agent (ai_jobs, kind dm_reply).
// Safety: content guards (no price talk, no unknown addresses), no links unless the person asked, no long dashes;
// anything off goes to the owner instead. Every reply is copied to the owner with a delete button.
import { z } from "zod";
import { audit, bump, getSetting } from "./core.js";
import { db } from "./db.js";
import { checkContent } from "./guards.js";
import { jsonInstruction } from "./llm.js";
import { project } from "./project.js";
import { tg } from "./telegram.js";

export const DmReply = z.object({
  skip: z.boolean().describe("true when no reply is needed (e.g. 'ok', an emoji, a goodbye)"),
  reply: z.string().max(600).describe("the message to send, empty when skip is true"),
  forward_to_owner: z.boolean().describe("true when only the founder should answer this personally (business, legal, complaints, anything unsure)"),
});

const SYSTEM = () => {
  const p = project();
  const x = p.drop?.x?.rounds;
  return `You are the founder of CHEK, answering messages people send to the CHEK Telegram channel. You are a real person who is fired up about building this. Write like you text: lowercase, casual, warm, 1 or 2 short sentences, sometimes one emoji. Answer what they actually said, in the flow of the conversation. Never paste a pitch or a list. Never repeat something you already said in this conversation.

FACTS (only these; if something isn't here, say you'll share it soon or ask them back):
- CHEK is a meme project launching on Solana. Mascot Chek, a thermal-paper receipt that only prints what it can prove. Motto: receipts or it didn't happen. Brand CHEK, token $${p.ticker}.
- The token is NOT live yet. Launch on Pump.fun, SOL pair, no presale, no whitelist, 0% free team allocation, the creator makes one public buy at creation (about $200). The exact launch time gets announced at least 24h ahead in the pinned posts on X and here. Never give a date or time yourself.
- No contract address exists before launch; it appears at the same minute on the site, the pinned X post and the pinned post here. Anything before that isn't us.
- Live now: website, receipt generator (anyone prints a receipt for any claim, no wallet), the receipt bot @chekcoinsol_bot, a public build log and receipt board, giveaways.
- Giveaways: on X every giveaway post is its own round${x ? `, ${x.winners} winners × ${x.each.toLocaleString("en-US")} $${p.ticker} each` : ""}, drawn 24h after the post; to enter: reply under the round with a SOL address, then paste the reply link on the drop page of the site. In Telegram: address in the comments under the pinned giveaway post. Tokens are sent after launch. No wallet connect, nothing to pay.
- After launch: proof of hold (sign a message, no transaction), holder votes on memes and lore (participation, not ownership), receipt of the week.
- Growth: giveaway rounds, the receipt generator as a meme engine, daily posts, building in public. No bought followers, no bots.

RULES:
- Never talk about price, returns, "moon", "100x", pumps, listings, or tell anyone to buy.
- No links unless they ask for one; then only ${p.links.website.replace(/^https?:\/\//, "")} or t.me/chekcoinsol.
- Never use the long dash character; use commas or periods.
- Service offers, "let me be your marketer/manager", "let's connect", paid promo: politely decline in one line, we build it ourselves.
- If they ask whether a bot is answering: be honest, a bot sometimes catches messages, now it's you.
- Never ask for or accept seed phrases, private keys, wallet connections or payments. Never DM people first.
- If the message needs the founder personally (business deal, complaint, legal, money, anything you are unsure about), set forward_to_owner true and keep reply empty.`;
};

const fmtLine = (r) => `${r.data?.ours ? "YOU" : "THEM"}: ${String(r.text || "").replace(/\s+/g, " ").slice(0, 500)}`;

// Last messages of this conversation (both sides), oldest first.
async function conversation(sql, topic) {
  const rows = await sql`select text, data, created_at from chek.interactions where platform = 'telegram' and kind = 'dm'
    and data->>'topic' = ${String(topic)} order by created_at desc limit 16`;
  return rows.reverse();
}

// Queue (or refresh) the AI reply for a conversation. Several messages in a row are answered once.
// The owner talking personally in a conversation (in the last 6 h) = the AI stays out of it.
export async function ownerActive(sql, topic) {
  const muted = (await getSetting("inbox_muted")) || [];
  if (muted.map(String).includes(String(topic))) return true; // the owner switched the AI off for this chat
  const [r] = await sql`select 1 from chek.interactions where kind = 'dm' and data->>'topic' = ${String(topic)}
    and data->>'by' = 'owner' and created_at > now() - interval '6 hours' limit 1`;
  return Boolean(r);
}

// Telegram doesn't send the bot what the owner types in the channel's DMs from the app. When someone quotes a
// channel message the bot never sent, the owner wrote it: record it, so the AI knows the owner is in this chat.
export async function noteQuotedOwnerMessage(m) {
  const q = m.reply_to_message;
  if (!q || !(q.sender_chat || q.from?.is_bot === false)) return;
  const sql = await db();
  const [known] = await sql`select 1 from chek.interactions where id = ${`dmo-${m.chat.id}-${q.message_id}`}`;
  if (!known) await recordSent(m.chat.id, m.direct_messages_topic?.topic_id ?? null, q.message_id, q.text || q.caption || "", "owner");
}

export async function queueDmReply(chat, topic, upTo) {
  const sql = await db();
  if (await ownerActive(sql, topic)) return null;
  const history = await conversation(sql, topic);
  const prompt = `Conversation in the CHEK channel's direct messages (oldest first). Reply to THEM's latest message(s) as YOU.\n\n${history.map(fmtLine).join("\n")}`;
  const meta = { chat, topic, upTo };
  const [open] = await sql`select id from chek.ai_jobs where kind = 'dm_reply' and status = 'queued' and meta->>'topic' = ${String(topic)} limit 1`;
  if (open) {
    await sql`update chek.ai_jobs set prompt = ${prompt}, meta = ${sql.json(meta)} where id = ${open.id} and status = 'queued'`;
    return Number(open.id);
  }
  const ai = (await getSetting("ai")) || {};
  const [row] = await sql`insert into chek.ai_jobs (kind, model, system, prompt, meta, expires_at)
    values ('dm_reply', ${ai.model || "claude-opus-5-5"}, ${`${SYSTEM()}\n\n${jsonInstruction(DmReply)}`}, ${prompt}, ${sql.json(meta)}, now() + interval '10 minutes')
    returning id`;
  return Number(row.id);
}

// Operator test: one made-up message → the AI's draft goes to the owner's bot chat only.
export async function queueDmTest(sample) {
  const sql = await db();
  const ai = (await getSetting("ai")) || {};
  const [row] = await sql`insert into chek.ai_jobs (kind, model, system, prompt, meta, expires_at)
    values ('dm_reply', ${ai.model || "claude-opus-5-5"}, ${`${SYSTEM()}\n\n${jsonInstruction(DmReply)}`},
      ${`Conversation in the CHEK channel's direct messages (oldest first). Reply to THEM's latest message(s) as YOU.\n\nTHEM: ${String(sample).slice(0, 500)}`},
      ${sql.json({ dry: true, sample: String(sample).slice(0, 300) })}, now() + interval '10 minutes') returning id`;
  return Number(row.id);
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(xyz|com|io|net|org|me)\b|t\.me\/)/i;

// The AI answered: check it, then send it 20–60 s after their last message ("typing…" first). Returns a promise to wait on.
export async function applyDmReply(out, meta) {
  const sql = await db();
  const owner = (await getSetting("owner"))?.telegramUserId;
  if (meta.dry) {
    // operator test: the draft goes to the owner only
    const reply = String(out.reply || "").replace(/\s*—\s*/g, ", ").trim();
    const v = reply ? checkContent({ platform: "telegram", parts: [reply], origin: "ai", level: "auto", ack: [], allowMentions: [], project: project() }) : { ok: true, problems: [] };
    await tg("sendMessage", { chat_id: owner, text: `🧪 test (nothing was sent to anyone)\nthem: ${meta.sample}\n\nAI: ${out.skip ? "(no reply)" : reply}${out.forward_to_owner ? "\n→ would forward to you" : ""}${v.ok ? "" : `\n✋ ${v.problems.join("; ")}`}` }).catch(() => {});
    return { dry: true, reply, skip: out.skip, forward: out.forward_to_owner };
  }
  // a newer message from them arrived after this job was built → the newer job answers everything
  const [newer] = await sql`select 1 from chek.interactions where kind = 'dm' and data->>'topic' = ${String(meta.topic)}
    and (data->>'msg')::bigint > ${meta.upTo} and coalesce((data->>'ours')::boolean, false) = false limit 1`;
  if (newer) return { superseded: true };
  // they were answered by hand in the meantime
  const [handled] = await sql`select 1 from chek.interactions where kind = 'dm' and data->>'topic' = ${String(meta.topic)}
    and coalesce((data->>'ours')::boolean, false) = true and (data->>'msg')::bigint > ${meta.upTo} limit 1`;
  if (handled) return { answeredByHand: true };
  if (await ownerActive(sql, meta.topic)) return { ownerTalking: true };
  const last = (await conversation(sql, meta.topic)).filter((r) => !r.data?.ours).pop();
  const askedLink = /(link|website|site|url)/i.test(last?.text || "");
  let reply = String(out.reply || "").replace(/\s*—\s*/g, ", ").trim();
  const problems = [];
  if (out.forward_to_owner) problems.push("the AI thinks you should answer this one yourself");
  if (!out.skip && !reply) problems.push("empty reply");
  if (reply && LINK.test(reply) && !askedLink) problems.push("link without being asked");
  if (reply) {
    const v = checkContent({ platform: "telegram", parts: [reply], origin: "ai", level: "auto", ack: [], allowMentions: [], project: project() });
    if (!v.ok) problems.push(...v.problems);
  }
  if (out.skip && !out.forward_to_owner) return { skipped: true };
  if (problems.length) {
    await tg("sendMessage", { chat_id: owner, text: `✋ Not sent automatically (${problems.join("; ")}). Reply to the forwarded message to answer.${reply ? `\n\nDraft:\n${reply}` : ""}` }).catch(() => {});
    return { held: problems };
  }
  const baseAt = last ? new Date(last.created_at).getTime() : Date.now();
  const at = Math.max(Date.now() + 4000, baseAt + (20 + Math.floor(Math.random() * 41)) * 1000);
  return { send: () => sendAsChannel({ chat: meta.chat, topic: meta.topic, text: reply, at }) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// Send as the channel into one conversation: "typing…", the message, record it, copy to the owner with 🗑.
export async function sendAsChannel({ chat, topic, text, at = Date.now() }) {
  await sleep(at - Date.now() - 4000);
  const where = { chat_id: Number(chat), ...(topic ? { direct_messages_topic_id: Number(topic) } : {}) };
  await tg("sendChatAction", { ...where, action: "typing" }).catch(() => {});
  await sleep(Math.min(4000, Math.max(1500, at - Date.now())));
  const msg = await tg("sendMessage", { ...where, text, link_preview_options: { is_disabled: true } });
  const sql = await db();
  await sql`insert into chek.interactions (id, platform, kind, author, text, at, status, data)
    values (${`dmo-${chat}-${msg.message_id}`}, 'telegram', 'dm', 'CHEK', ${text}, now(), 'handled', ${sql.json({ chat: Number(chat), topic: topic ?? null, msg: msg.message_id, ours: true, by: "ai" })})
    on conflict (id) do nothing`;
  await bump("dm_ai_replies");
  const owner = (await getSetting("owner"))?.telegramUserId;
  if (owner)
    await tg("sendMessage", {
      chat_id: owner,
      text: `🤖 replied as the channel:\n${text}`,
      disable_notification: true,
      reply_markup: { inline_keyboard: [[{ text: "🗑 delete this reply", callback_data: `dd:${chat}:${msg.message_id}` }]] },
    }).catch(() => {});
  await audit("inbox", "telegram.dm_ai_reply", "ok", { ref: `dmo-${chat}-${msg.message_id}` });
  return msg.message_id;
}

// Anything sent as the channel into a conversation (owner replies through the bot, admin sends) — kept for context.
export async function recordSent(chat, topic, msgId, text, by) {
  const sql = await db();
  await sql`insert into chek.interactions (id, platform, kind, author, text, at, status, data)
    values (${`dmo-${chat}-${msgId}`}, 'telegram', 'dm', 'CHEK', ${String(text).slice(0, 2000)}, now(), 'handled',
      ${sql.json({ chat: Number(chat), topic: topic ?? null, msg: msgId, ours: true, by })}) on conflict (id) do nothing`;
}

// Our side of the chat (the owner typing in the channel's DMs, or anything sent as the channel) — kept for context.
export async function recordOurs(m) {
  const sql = await db();
  await sql`insert into chek.interactions (id, platform, kind, author, text, at, status, data)
    values (${`dmo-${m.chat.id}-${m.message_id}`}, 'telegram', 'dm', 'CHEK', ${(m.text || m.caption || "").slice(0, 2000)}, now(), 'handled',
      ${sql.json({ chat: m.chat.id, topic: m.direct_messages_topic?.topic_id ?? null, msg: m.message_id, ours: true, by: "owner" })}) on conflict (id) do nothing`;
  // the owner typed an answer in the channel chat: the AI stays quiet on this conversation
  if (m.direct_messages_topic?.topic_id) await sql`update chek.ai_jobs set status = 'expired', error = 'owner answered' where kind = 'dm_reply' and status = 'queued' and meta->>'topic' = ${String(m.direct_messages_topic.topic_id)}`;
}
