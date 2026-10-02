// Messages to the channel (channel direct messages) and questions in the comments.
// Answers are short, in the founder's own voice: excited about the build, never about price — no price talk, no
// promises, no links except the official ones, and the contract address never before launch.
// Known topics are answered at once (once per person and topic per 12 h); everything else goes to the owner with
// ready answers on buttons, or the owner replies to the forwarded message and the bot sends it as the channel.
import { audit, bump } from "./core.js";
import { db } from "./db.js";
import { project } from "./project.js";
import { tg } from "./telegram.js";
import { queueDmReply, recordOurs, recordSent } from "./dmreply.js";

const RULES = [
  // a pitch, not a question: "I can / I have something / let's connect / our services"
  ["offer", /(let'?s connect|down for a (chat|call)|might interest you|i have (some )?(suggestions|ideas|something|a proposal|an offer)|i can (help|bring|get|grow|boost|promote|manage|handle)|can help (the|your) project|(my|our) (services|agency|team can|network)|business (proposal|offer)|work with you|hire me|come in as|price list|\bpackage\b|\bkol\b|call channel|trending (service|spot)|volume bot|paid promotion)/i],
  ["launch", /(when.*(launch|live|token|coin|ca\b)|launch (date|time)|contract|\bca\b|\bmint\b|pump\.?fun|presale|pre-sale|whitelist|\bwl\b|where (can|to) buy|how (can i|to) buy|ticker)/i],
  ["drop", /(airdrop|giveaway|give away|\bdrop\b|winner|\bwin\b|enter|wallet address|my address|sol address)/i],
  ["growth", /(more (active )?(members|holders|people|users|followers)|visibility|marketing|grow (the|this|your)|plans? (to|for) (get|grow|market|reach)|get the word out|reach more)/i],
  // "wsg chat?" is a greeting to the room, not a question about our chat: only explicit asks count
  ["chat", /(group ?chat|telegram (group|chat)|(is there|do you have|any|where('s| is)?( the)?|join the|link to the) (a )?(group|chat|community))/i],
  ["project", /(long.?term|legit|\bscam|\brug|serious|future|roadmap|\bplan\b|what is (this|chek)|about (the )?project|who (is|are) (behind|the dev)|team behind|dev doxx)/i],
  // small talk gets a short human line, not a project pitch
  ["howareyou", /(how (are|r) (you|u)|how('?s| is) it going|how (you|u) doing|\bwyd\b|what'?s up|\bwsg\b)/i],
  ["hype", /(big deal|gonna (be )?(big|huge|moon|run)|love (this|the|it)|bullish|\blfg\b|this is (fire|huge|sick|cool)|\bgem\b|early on this|\bsolid\b|awesome|well done|respect|great (project|work|idea|job)|nice (project|work|one))/i],
  ["gm", /^\s*((gm+|gn|hi+|hey|hello|yo|sup)[\s!.,]*)+(fam|buddy|bro|sir|all|guys|dev|chat|ser)?[\s!.,🙌☀️🔥]*$/i],
];
export const classify = (text) => RULES.find(([, re]) => re.test(text ?? ""))?.[0] ?? "other";

// Owner's style rules for replies: no links unless the person asks for one, no long dashes.
export const wantsLink = (text) =>
  /((send|share|drop|give|post|got|have|what'?s|whats|where'?s|where is)( me| us)?( the| your| a)? (link|site|website|url)|(link|website|site|url)\s*\?)/i.test(text ?? "");

export function answer(kind, { links = false } = {}, p = project()) {
  const t = `$${p.ticker}`;
  const site = p.links.website.replace(/^https?:\/\/(www\.)?/, "");
  const x = p.drop?.x?.rounds;
  const n = (v) => v.toLocaleString("en-US");
  const onSite = (path, words) => (links ? `${site}${path}` : words);
  return {
    gm: `gm 🙌 glad you found us. ask me anything about CHEK`,
    howareyou: `doing great, thanks for asking 🙌 building all day over here. glad you're here`,
    hype: `appreciate that a lot 🙏 I'm building it every day, so this kind of message means a lot. glad you're here early`,
    project: `honestly? this is my thing right now. I'm building CHEK every single day. the site, the receipt bot and the giveaways are already live and the token isn't even out yet. after launch I keep shipping, all in public, every step with a receipt 🧾 stick around, we're just getting started`,
    launch: `not live yet 🙌 I'll announce the exact launch time at least 24h ahead, on X and here. the contract address goes up at the same minute on ${onSite("", "our site")}, the pinned X post and the pinned post here. anything before that isn't us. turn on notifications for the channel 🧾`,
    drop: x
      ? `yes! two giveaways running 🎁 on X every giveaway post is its own round: ${x.winners} winners × ${n(x.each)} ${t}, drawn 24h after the post. reply with your SOL address and lock it in on ${onSite("/drop", "the drop page of our site")}. here in telegram just drop your address in the comments under the pinned giveaway post. tokens get sent after launch, no wallet connect, nothing to pay`
      : `yes, there's a giveaway 🎁 all the rules are on ${onSite("/drop", "the drop page of our site")}`,
    growth: `great question 🙌 right now we run giveaway rounds on X every few hours, ${x ? `${x.winners} winners each` : "winners every round"}, drawn 24h after the post and announced publicly so anyone can re-check them. there's the receipt generator: anyone can print a receipt for any claim and share it, that's our meme engine. and daily posts: lore, short videos, the plan, all built in public. no bought followers, no bots, real people only. want to help? repost the latest round on X and print a receipt on ${onSite("/print", "the site")} 🧾`,
    chat: `the chat's already open 🙌 jump into the comments under any post here, that's where we hang out`,
    offer: `appreciate you reaching out, but we're not using any outside growth services and we don't hand out roles. building this ourselves 🙏 all the best`,
  }[kind];
}

// Was this person already answered on this topic recently? (keeps the bot from repeating itself)
async function answeredRecently(sql, authorId, kind, hours) {
  const [r] = await sql`select 1 from chek.interactions where platform = 'telegram' and author_id = ${String(authorId)}
    and data->>'answered' = ${kind} and created_at > now() - make_interval(hours => ${hours}) limit 1`;
  return Boolean(r);
}

const nameOf = (u) => (u?.username ? `@${u.username}` : [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "someone");

// Info answers (launch, giveaway, …) only go to real questions; praise gets a thank-you instead of instructions.
const QUESTION = /\?|^\s*(how|when|wen|where|what|whats|is|are|can|could|do|does|will|who|why|any)\b|\b(how (do|can|to)|when|where)\b/i;
const INFO = new Set(["launch", "drop", "growth", "chat", "project"]);
export function topicOf(text) {
  const kind = classify(text);
  if (INFO.has(kind) && !QUESTION.test(text)) return RULES.find(([k]) => k === "hype")[1].test(text) ? "hype" : "other";
  return kind;
}

// A person doesn't answer in one second: replies wait 20–60 s, show "typing…", then go out. The webhook answers
// Telegram at once and sends the reply in the background (deliver); the scheduler re-tries anything left queued.
const delayMs = () => (20 + Math.floor(Math.random() * 41)) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// A message in the channel's direct messages chat.
export async function dmMessage(m, owner) {
  if (!m.from || m.from.is_bot) return null;
  if (m.sender_chat || (owner && m.from.id === owner)) {
    await recordOurs(m); // our own side of the chat: kept so the AI sees the whole conversation
    return null;
  }
  const text = m.text || m.caption || "";
  const topic = m.direct_messages_topic?.topic_id;
  const sql = await db();
  const kind = topicOf(text);
  const id = `dm-${m.chat.id}-${m.message_id}`;
  const [seen] = await sql`select 1 from chek.interactions where id = ${id}`;
  if (seen) return null; // Telegram re-delivered the same update
  // settings.inbox_auto: "ai" = live AI replies that read the conversation; true = old canned answers; off otherwise
  const mode = (await sql`select value from chek.settings where key = 'inbox_auto'`)[0]?.value;
  if (mode === "ai") {
    const fwdAi = owner
      ? await tg("sendMessage", {
          chat_id: owner,
          text: `💬 Message to the channel from ${nameOf(m.from)}:\n\n${text.slice(0, 1500) || "(media)"}\n\n🤖 the AI answers in ~20–60 s. To answer yourself instead, reply to this message now.`,
          link_preview_options: { is_disabled: true },
          disable_notification: true,
        }).catch(() => null)
      : null;
    await sql`insert into chek.interactions (id, platform, kind, author, author_id, text, at, status, data)
      values (${id}, 'telegram', 'dm', ${m.from.username ?? null}, ${String(m.from.id)}, ${text.slice(0, 2000)}, now(), 'new',
        ${sql.json({ chat: m.chat.id, topic: topic ?? null, msg: m.message_id, kind, ownerMsg: fwdAi?.message_id ?? null })}) on conflict (id) do nothing`;
    if (topic) await queueDmReply(m.chat.id, topic, m.message_id);
    return null;
  }
  let sent = null;
  let at = null;
  if (mode === true && kind !== "other" && !(await answeredRecently(sql, m.from.id, kind, 12))) {
    sent = answer(kind, { links: wantsLink(text) });
    at = new Date(Date.now() + delayMs());
    await bump(`dm_auto_${kind}`);
  }
  // the owner always sees it; unknown ones come with ready answers on buttons
  const head = `💬 Message to the channel from ${nameOf(m.from)}:\n\n${text.slice(0, 1500) || "(media)"}`;
  const note = sent
    ? `\n\n↩️ answering in ~${Math.round((at.getTime() - Date.now()) / 1000)} s (${kind}):\n${sent}`
    : "\n\nReply to this message to answer as the channel, or pick a ready answer:";
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
    values (${id}, 'telegram', 'dm', ${m.from.username ?? null}, ${String(m.from.id)}, ${text.slice(0, 2000)}, now(), ${sent ? "queued" : "new"},
      ${sql.json({ chat: m.chat.id, topic: topic ?? null, msg: m.message_id, kind, answered: sent ? kind : null, ownerMsg: fwd?.message_id ?? null, ...(sent ? { pending: { text: sent, at: at.toISOString() } } : {}) })})
    on conflict (id) do nothing`;
  return sent ? id : null;
}

// Send one queued reply when its wait is over: claim it (so the scheduler can't send it twice), "typing…", send.
export async function deliver(id) {
  const sql = await db();
  const [it0] = await sql`select data from chek.interactions where id = ${id} and status = 'queued' and data ? 'pending'`;
  if (!it0) return false;
  const wait = Date.parse(it0.data.pending.at) - Date.now();
  await sleep(wait - 5000);
  const [it] = await sql`update chek.interactions set status = 'handled' where id = ${id} and status = 'queued' returning *`;
  if (!it) return false; // the owner answered by hand in the meantime, or it was already sent
  const d = it.data;
  const where = { chat_id: Number(d.chat), ...(d.topic ? { direct_messages_topic_id: d.topic } : {}) };
  await tg("sendChatAction", { ...where, action: "typing" }).catch(() => {});
  await sleep(Math.min(5000, Math.max(2500, wait)));
  const ok = await tg("sendMessage", {
    ...where,
    text: d.pending.text,
    link_preview_options: { is_disabled: true },
    ...(it.kind === "comment" ? { reply_parameters: { message_id: d.msg, allow_sending_without_reply: true } } : {}),
  })
    .then(() => true)
    .catch(() => false);
  await sql`update chek.interactions set status = ${ok ? "handled" : "ignored"}, data = data - 'pending' || ${sql.json({ sentAt: new Date().toISOString(), sent: ok })} where id = ${id}`;
  return ok;
}

// Scheduler fallback: anything still queued past its time (e.g. the function was stopped) goes out now.
export async function sendPendingReplies() {
  const sql = await db();
  const due = await sql`select id from chek.interactions where platform = 'telegram' and status = 'queued' and data ? 'pending'
    and (data->'pending'->>'at')::timestamptz <= now() - interval '1 minute' order by created_at limit 10`;
  let n = 0;
  for (const it of due) if (await deliver(it.id).catch(() => false)) n++;
  return { sent: n };
}

// A question in the comments (discussion group): known topics get a short reply in the thread.
// The group is a live chat: the bot stays out of small talk and only answers clear questions to the project
// (launch / contract address / giveaway / "is this a rug?"), never messages that answer someone else.
const CHAT_KINDS = new Set(["launch", "drop", "project"]);
const RISK = /(legit|\bscam|\brug)/i;
export async function commentQuestion(m) {
  const text = m.text || "";
  const kind = classify(text);
  if (!CHAT_KINDS.has(kind) || (kind === "project" && !RISK.test(text))) return false;
  if (!text.includes("?")) return false; // only real questions
  const to = m.reply_to_message;
  if (to && !to.is_automatic_forward && !to.sender_chat && to.from && !to.from.is_bot) return false; // talking to another person
  const sql = await db();
  if ((await sql`select value from chek.settings where key = 'inbox_auto'`)[0]?.value !== true) return false; // off unless switched on
  if (await answeredRecently(sql, m.from.id, kind, 6)) return false;
  const pending = { text: answer(kind, { links: wantsLink(text) }), at: new Date(Date.now() + delayMs()).toISOString() };
  await sql`insert into chek.interactions (id, platform, kind, author, author_id, text, at, status, data)
    values (${`cm-${m.chat.id}-${m.message_id}`}, 'telegram', 'comment', ${m.from.username ?? null}, ${String(m.from.id)}, ${text.slice(0, 2000)}, now(), 'queued',
      ${sql.json({ chat: m.chat.id, msg: m.message_id, kind, answered: kind, pending })}) on conflict (id) do nothing`;
  await bump(`comment_auto_${kind}`);
  return `cm-${m.chat.id}-${m.message_id}`;
}

// Owner tapped a ready answer under a forwarded message.
export async function ownerPick(kind, chat, msg) {
  const sql = await db();
  const [it] = await sql`select * from chek.interactions where id = ${`dm-${chat}-${msg}`}`;
  if (!it || !answer(kind)) return false;
  await tg("sendMessage", { chat_id: Number(chat), direct_messages_topic_id: it.data.topic ?? undefined, text: answer(kind, { links: wantsLink(it.text) }), link_preview_options: { is_disabled: true } });
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
  const sent = await tg("sendMessage", { chat_id: Number(it.data.chat), direct_messages_topic_id: it.data.topic ?? undefined, text: m.text, link_preview_options: { is_disabled: true } });
  await sql`update chek.interactions set status = 'handled', data = data || ${sql.json({ answered: "owner" })} where id = ${it.id}`;
  // the owner answered: the AI stays quiet on this one
  await recordSent(it.data.chat, it.data.topic, sent.message_id, m.text, "owner");
  await sql`update chek.ai_jobs set status = 'expired', error = 'owner answered' where kind = 'dm_reply' and status = 'queued' and meta->>'topic' = ${String(it.data.topic)}`;
  await audit("owner", "telegram.dm_answered", "ok", { ref: it.id, detail: { kind: "owner" } });
  return true;
}
