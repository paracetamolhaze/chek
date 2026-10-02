// Messages to the channel (channel direct messages) and questions in the comments.
// Answers are short, in the founder's own voice: excited about the build, never about price — no price talk, no
// promises, no links except the official ones, and the contract address never before launch.
// Known topics are answered at once (once per person and topic per 12 h); everything else goes to the owner with
// ready answers on buttons, or the owner replies to the forwarded message and the bot sends it as the channel.
import { audit, bump } from "./core.js";
import { db } from "./db.js";
import { project } from "./project.js";
import { tg } from "./telegram.js";

const RULES = [
  // a pitch, not a question: "I can / I have something / let's connect / our services"
  ["offer", /(let'?s connect|down for a (chat|call)|might interest you|i have (some )?(suggestions|ideas|something|a proposal|an offer)|i can (help|bring|get|grow|boost|promote|manage|handle)|can help (the|your) project|(my|our) (services|agency|team can|network)|business (proposal|offer)|work with you|hire me|come in as|price list|\bpackage\b|\bkol\b|call channel|trending (service|spot)|volume bot|paid promotion)/i],
  ["launch", /(when.*(launch|live|token|coin|ca\b)|launch (date|time)|contract|\bca\b|\bmint\b|pump\.?fun|presale|pre-sale|whitelist|\bwl\b|where (can|to) buy|how (can i|to) buy|ticker)/i],
  ["drop", /(airdrop|giveaway|give away|\bdrop\b|winner|\bwin\b|enter|wallet address|my address|sol address)/i],
  ["growth", /(more (active )?(members|holders|people|users|followers)|visibility|marketing|grow (the|this|your)|plans? (to|for) (get|grow|market|reach)|get the word out|reach more)/i],
  ["chat", /(group ?chat|telegram (group|chat)|\bchat\b)/i],
  ["project", /(long.?term|legit|\bscam|\brug|serious|future|roadmap|\bplan\b|what is (this|chek)|about (the )?project|who (is|are) (behind|the dev)|team|\bdev\b)/i],
  ["gm", /^\s*(gm|gn|hi|hey|hello|yo|sup|hii+|gm+ (fam|buddy|bro|sir|all))[\s!.🙌☀️🔥]*$/i],
];
export const classify = (text) => RULES.find(([, re]) => re.test(text ?? ""))?.[0] ?? "other";

export function answer(kind, p = project()) {
  const t = `$${p.ticker}`;
  const site = p.links.website.replace(/^https?:\/\//, "");
  const x = p.drop?.x?.rounds;
  const n = (v) => v.toLocaleString("en-US");
  return {
    gm: `gm 🙌 glad you found us. ask me anything about CHEK`,
    project: `honestly? this is my thing right now. I'm building CHEK every single day — the site, the receipt bot and the giveaways are already live and the token isn't even out yet. after launch I keep shipping, all in public, every step with a receipt 🧾 stick around, we're just getting started`,
    launch: `not live yet 🙌 I'll announce the exact launch time at least 24h ahead, on X and here. the contract address goes up at the same minute on ${site}, the pinned X post and the pinned post here — anything before that isn't us. turn on notifications for the channel 🧾`,
    drop: x
      ? `yes! two giveaways running 🎁 on X every drop post is its own round — ${x.winners} winners × ${n(x.each)} ${t}, drawn 24h after the post: reply with your SOL address, then paste your reply link at ${site}/drop. here in telegram: drop your address in the comments under the pinned giveaway post. tokens get sent after launch — no wallet connect, nothing to pay`
      : `the giveaway rules are on ${site}/drop 🎁`,
    growth: `great question 🙌 right now: giveaway rounds on X every few hours — ${x ? `${x.winners} winners each` : "winners every round"}, drawn 24h after the post and announced publicly, anyone can re-check them on ${site}/drop. the receipt generator — anyone can print a receipt for any claim and share it, that's our meme engine. and daily posts: lore, short videos, the plan, all built in public. no bought followers, no bots — real people only. want to help? repost the latest round on X and print a receipt at ${site}/print 🧾`,
    chat: `the chat's already open 🙌 jump into the comments under any post here — that's where we hang out`,
    offer: `appreciate you reaching out, but we're not using any outside growth services and we don't hand out roles — building this ourselves 🙏 all the best`,
  }[kind];
}

// Was this person already answered on this topic recently? (keeps the bot from repeating itself)
async function answeredRecently(sql, authorId, kind, hours) {
  const [r] = await sql`select 1 from chek.interactions where platform = 'telegram' and author_id = ${String(authorId)}
    and data->>'answered' = ${kind} and created_at > now() - make_interval(hours => ${hours}) limit 1`;
  return Boolean(r);
}

const nameOf = (u) => (u?.username ? `@${u.username}` : [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "someone");

// A message in the channel's direct messages chat.
export async function dmMessage(m, owner) {
  if (!m.from || m.from.is_bot || m.sender_chat || (owner && m.from.id === owner)) return; // our own side of the chat
  const text = m.text || m.caption || "";
  const topic = m.direct_messages_topic?.topic_id;
  const sql = await db();
  const kind = classify(text);
  const id = `dm-${m.chat.id}-${m.message_id}`;
  let sent = null;
  if (kind !== "other" && !(await answeredRecently(sql, m.from.id, kind, 12))) {
    sent = answer(kind);
    await tg("sendMessage", { chat_id: m.chat.id, direct_messages_topic_id: topic, text: sent, link_preview_options: { is_disabled: true } });
    await bump(`dm_auto_${kind}`);
  }
  // the owner always sees it; unknown ones come with ready answers on buttons
  const head = `💬 Message to the channel from ${nameOf(m.from)}:\n\n${text.slice(0, 1500) || "(media)"}`;
  const note = sent ? `\n\n↩️ answered (${kind}):\n${sent}` : "\n\nReply to this message to answer as the channel, or pick a ready answer:";
  const buttons = sent
    ? null
    : [
        [
          { text: "About the project", callback_data: `dm:project:${m.chat.id}:${m.message_id}` },
          { text: "Launch", callback_data: `dm:launch:${m.chat.id}:${m.message_id}` },
        ],
        [
          { text: "Giveaway", callback_data: `dm:drop:${m.chat.id}:${m.message_id}` },
          { text: "Decline offer", callback_data: `dm:offer:${m.chat.id}:${m.message_id}` },
        ],
      ];
  const fwd = owner
    ? await tg("sendMessage", { chat_id: owner, text: (head + note).slice(0, 4000), link_preview_options: { is_disabled: true }, reply_markup: buttons ? { inline_keyboard: buttons } : undefined }).catch(() => null)
    : null;
  await sql`insert into chek.interactions (id, platform, kind, author, author_id, text, at, status, data)
    values (${id}, 'telegram', 'dm', ${m.from.username ?? null}, ${String(m.from.id)}, ${text.slice(0, 2000)}, now(), ${sent ? "handled" : "new"},
      ${sql.json({ chat: m.chat.id, topic: topic ?? null, msg: m.message_id, kind, answered: sent ? kind : null, ownerMsg: fwd?.message_id ?? null })})
    on conflict (id) do nothing`;
}

// A question in the comments (discussion group): known topics get a short reply in the thread.
export async function commentQuestion(m) {
  const text = m.text || "";
  const kind = classify(text);
  if (!["launch", "drop", "growth", "chat", "project"].includes(kind)) return false;
  if (!/\?|when|how|where|what|is this|legit/i.test(text)) return false; // statements and hype aren't questions
  const sql = await db();
  if (await answeredRecently(sql, m.from.id, kind, 6)) return false;
  await tg("sendMessage", { chat_id: m.chat.id, text: answer(kind), reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true }, link_preview_options: { is_disabled: true } });
  await sql`insert into chek.interactions (id, platform, kind, author, author_id, text, at, status, data)
    values (${`cm-${m.chat.id}-${m.message_id}`}, 'telegram', 'comment', ${m.from.username ?? null}, ${String(m.from.id)}, ${text.slice(0, 2000)}, now(), 'handled',
      ${sql.json({ chat: m.chat.id, msg: m.message_id, kind, answered: kind })}) on conflict (id) do nothing`;
  await bump(`comment_auto_${kind}`);
  return true;
}

// Owner tapped a ready answer under a forwarded message.
export async function ownerPick(kind, chat, msg) {
  const sql = await db();
  const [it] = await sql`select * from chek.interactions where id = ${`dm-${chat}-${msg}`}`;
  if (!it || !answer(kind)) return false;
  await tg("sendMessage", { chat_id: Number(chat), direct_messages_topic_id: it.data.topic ?? undefined, text: answer(kind), link_preview_options: { is_disabled: true } });
  await sql`update chek.interactions set status = 'handled', data = data || ${sql.json({ answered: kind })} where id = ${it.id}`;
  await audit("owner", "telegram.dm_answered", "ok", { ref: it.id, detail: { kind } });
  return true;
}

// Owner replied (in the bot chat) to a forwarded message → send that text to the person as the channel.
export async function ownerReply(m) {
  const to = m.reply_to_message?.message_id;
  if (!to || !m.text) return false;
  const sql = await db();
  const [it] = await sql`select * from chek.interactions where kind = 'dm' and (data->>'ownerMsg')::bigint = ${to} limit 1`;
  if (!it) return false;
  await tg("sendMessage", { chat_id: Number(it.data.chat), direct_messages_topic_id: it.data.topic ?? undefined, text: m.text, link_preview_options: { is_disabled: true } });
  await sql`update chek.interactions set status = 'handled', data = data || ${sql.json({ answered: "owner" })} where id = ${it.id}`;
  await audit("owner", "telegram.dm_answered", "ok", { ref: it.id, detail: { kind: "owner" } });
  return true;
}
