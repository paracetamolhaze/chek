// X via the owner's Telegram (owner's choice, 2026-10-02): no X API, no browser automation. When an X post is due,
// the bot sends the owner the exact post — picture + text — with “Open X with this text” and “Copy text” buttons.
// The owner posts it by hand and taps ✅ (or pastes the post link). Threads go part by part: the link of the previous
// part lets the next “Open X” button reply to it. One X post is handed over at a time; unattended ones expire after 3 h.
import { alert, audit, bump } from "./core.js";
import { db } from "./db.js";
import { notifyOwner, tg } from "./telegram.js";

const STALE_MS = 3 * 3600e3;
const intent = (text, replyTo) => `https://x.com/intent/post?${new URLSearchParams({ text, ...(replyTo ? { in_reply_to: replyTo } : {}) })}`;
export const tweetIdOf = (link) => /(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/(\d{5,25})/.exec(String(link || ""))?.[1] ?? null;

function buttons(id, text, replyTo) {
  return [
    [{ text: replyTo ? "Open X (reply to the previous part)" : "Open X with this text", url: intent(text, replyTo) }],
    [{ text: "📋 Copy text", copy_text: { text } }],
    [
      { text: "✅ Posted", callback_data: `xp:${id}` },
      { text: "⏭ Skip", callback_data: `xs:${id}` },
    ],
  ];
}

async function sendPart(owner, row, h) {
  const i = h.part;
  const text = h.parts[i];
  const total = h.parts.length;
  const head = `X POST ${row.id}${total > 1 ? ` · part ${i + 1}/${total}` : ""}${row.payload.pin && i === 0 ? " · PIN IT after posting" : ""}`;
  const how = h.media && i === 0 ? "Attach the picture above, post, then tap ✅ — or paste the post link here." : "Post it, then tap ✅ — or paste the post link here.";
  const markup = { inline_keyboard: buttons(row.id, text, i > 0 ? h.links[i - 1] : null) };
  if (h.media && i === 0) {
    const caption = `${head}\n\n${text}\n\n${how}`;
    if (caption.length <= 1024) return tg("sendPhoto", { chat_id: owner, photo: h.media, caption, reply_markup: markup });
    await tg("sendPhoto", { chat_id: owner, photo: h.media, caption: head });
  }
  return notifyOwner(owner, `${head}\n\n${text}\n\n${how}`, markup.inline_keyboard);
}

/** Publisher calls this instead of the X API. Returns false when an earlier hand-over is still open. */
export async function handoffX(row, out, media, settings) {
  const sql = await db();
  const owner = settings.owner?.telegramUserId;
  if (!owner) return false;
  const [open] = await sql`select id, payload from chek.queue where platform = 'x' and status = 'publishing' and payload ? 'handoff' limit 1`;
  if (open) return false;
  const h = { sentAt: new Date().toISOString(), part: 0, parts: out.parts, links: [], media };
  await sendPart(owner, row, h); // a failed send changes nothing: the post stays due and is retried next tick
  await sql`update chek.queue set status = 'publishing', attempts = attempts + 1, payload = payload || ${sql.json({ handoff: h })}, updated_at = now() where id = ${row.id}`;
  await audit("publisher", "x.handed_to_owner", "ok", { ref: row.id, detail: { parts: out.parts.length, media } });
  return true;
}

/** ✅ / pasted link from the owner. Advances threads; marks the post published after the last part. */
export async function confirmPosted(id, link = null, owner = null) {
  const sql = await db();
  const [row] = await sql`select * from chek.queue where id = ${id} and platform = 'x' and status = 'publishing' and payload ? 'handoff'`;
  if (!row) return { ok: false, reason: "nothing waiting" };
  const h = row.payload.handoff;
  const tid = tweetIdOf(link);
  if (!tid && h.part + 1 < h.parts.length) {
    if (owner) await notifyOwner(owner, `Part ${h.part + 1} of ${row.id} is a thread: paste the link of the post you just made, so the next part can reply to it.`);
    return { ok: true, waitingForLink: true };
  }
  h.links[h.part] = tid;
  h.part += 1;
  if (h.part < h.parts.length) {
    await sql`update chek.queue set payload = payload || ${sql.json({ handoff: h })}, updated_at = now() where id = ${id}`;
    if (owner) await sendPart(owner, row, h);
    return { ok: true, next: h.part + 1 };
  }
  const first = h.links[0] ? `https://x.com/i/status/${h.links[0]}` : link || null;
  await sql`update chek.queue set status = 'published', external_id = ${h.links[0] ?? null}, external_url = ${first}, published_at = now(), last_error = null,
    payload = payload || ${sql.json({ handoff: { ...h, doneAt: new Date().toISOString() } })}, updated_at = now() where id = ${id}`;
  await audit("owner", "post.published.x", "ok", { ref: id, detail: { url: first, via: "telegram hand-over" } });
  await bump("posts_x");
  return { ok: true, published: true };
}

/** The open hand-over (for a pasted link). */
export async function openHandoff() {
  const sql = await db();
  const [row] = await sql`select id from chek.queue where platform = 'x' and status = 'publishing' and payload ? 'handoff' order by updated_at limit 1`;
  return row?.id ?? null;
}

export async function skipHandoff(id) {
  const sql = await db();
  const [row] = await sql`update chek.queue set status = 'skipped', last_error = 'owner skipped', updated_at = now() where id = ${id} and status = 'publishing' returning id`;
  if (row) await audit("owner", "post.skipped.x", "ok", { ref: id });
  return Boolean(row);
}

/** Hand-overs nobody acted on for 3 h expire, so the queue keeps moving (alert once). */
export async function expireHandoffs() {
  const sql = await db();
  const rows = await sql`update chek.queue set status = 'expired', last_error = 'not posted within 3 h of the hand-over', updated_at = now()
    where platform = 'x' and status = 'publishing' and payload ? 'handoff' and (payload->'handoff'->>'sentAt')::timestamptz < ${new Date(Date.now() - STALE_MS)}
    returning id`;
  for (const r of rows) await alert("warn", "x_handoff_expired", `X post ${r.id} was not posted within 3 h and expired.`, r.id);
  return rows.length;
}
