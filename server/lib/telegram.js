// Telegram Bot API (official). The bot token lives only in Vercel env (TELEGRAM_BOT_TOKEN).
import { env } from "./env.js";

const API = "https://api.telegram.org";

export async function tg(method, body = {}) {
  if (!env.telegramToken) throw new Error("telegram not configured");
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}/bot${env.telegramToken}/${method}`, {
    method: "POST",
    headers: isForm ? {} : { "content-type": "application/json" },
    body: isForm ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) {
    const err = new Error(`telegram ${method}: ${data.description || res.status}`);
    err.retryAfter = data.parameters?.retry_after;
    throw err;
  }
  return data.result;
}

// "@chekcoin" from "https://t.me/chekcoin"
export const chatFromLink = (link) => (link ? `@${link.replace(/^https?:\/\/t\.me\//, "").replace(/\/.*/, "")}` : null);

const isVideo = (u) => /\.(mp4|mov)$/i.test(u);
const isGif = (u) => /\.gif$/i.test(u);

// Publish one queue item (text, optional media by public URL, optional poll). Returns the message.
export async function publishTelegram({ chat, parts, mediaUrl = null, poll = null, pin = false, silent = false }) {
  const text = parts.join("\n\n");
  let msg;
  if (poll) {
    msg = await tg("sendPoll", { chat_id: chat, question: poll.question.slice(0, 300), options: poll.options.map((o) => ({ text: o.slice(0, 100) })), is_anonymous: true });
  } else if (mediaUrl) {
    const caption = text.length <= 1000 ? text : null;
    const base = { chat_id: chat, caption: caption ?? undefined, disable_notification: silent };
    msg = isVideo(mediaUrl)
      ? await tg("sendVideo", { ...base, video: mediaUrl })
      : isGif(mediaUrl)
        ? await tg("sendAnimation", { ...base, animation: mediaUrl })
        : await tg("sendPhoto", { ...base, photo: mediaUrl });
    if (!caption) msg = await tg("sendMessage", { chat_id: chat, text, link_preview_options: { is_disabled: true }, disable_notification: silent });
  } else {
    msg = await tg("sendMessage", { chat_id: chat, text, link_preview_options: { is_disabled: false }, disable_notification: silent });
  }
  if (pin) await tg("pinChatMessage", { chat_id: chat, message_id: msg.message_id, disable_notification: true });
  return msg;
}

export async function sendPhotoBuffer(chat, png, caption) {
  const form = new FormData();
  form.set("chat_id", String(chat));
  if (caption) form.set("caption", caption.slice(0, 1000));
  form.set("photo", new Blob([png], { type: "image/png" }), "receipt.png");
  return tg("sendPhoto", form);
}

export const messageUrl = (chat, id) => (String(chat).startsWith("@") ? `https://t.me/${String(chat).slice(1)}/${id}` : null);

// Owner DM with inline buttons (approvals, alerts).
export async function notifyOwner(ownerId, text, buttons = null) {
  if (!ownerId || !env.telegramToken) return null;
  return tg("sendMessage", {
    chat_id: ownerId,
    text: text.slice(0, 4000),
    link_preview_options: { is_disabled: true },
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  });
}
