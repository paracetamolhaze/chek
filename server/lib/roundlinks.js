// Telegram posts that point to "the latest X round" ({{X_ROUND_URL}}) are edited in place when a newer round
// (or a re-posted one) gets its link — so the channel never sends people to an old or deleted X post.
import { audit } from "./core.js";
import { db } from "./db.js";
import { context, render } from "./queue.js";
import { chatFromLink, tg } from "./telegram.js";

export async function refreshRoundLinks() {
  const sql = await db();
  const rows = await sql`select * from chek.queue where platform = 'telegram' and status = 'published' and external_id is not null
    and published_at > now() - interval '6 hours' and payload->'parts'->>0 like '%{{X_ROUND_URL}}%'`;
  if (!rows.length) return [];
  const ctx = await context();
  const edited = [];
  for (const row of rows) {
    const out = render(row, ctx);
    if (out.missing.length) continue;
    const chat = row.payload.where === "chat" ? chatFromLink(ctx.project.links.telegramChat) : chatFromLink(ctx.project.links.telegram);
    const text = out.parts.join("\n\n");
    const call = row.payload.asset
      ? tg("editMessageCaption", { chat_id: chat, message_id: Number(row.external_id), caption: text.slice(0, 1000) })
      : tg("editMessageText", { chat_id: chat, message_id: Number(row.external_id), text, link_preview_options: { is_disabled: false } });
    const ok = await call.then(() => true).catch((e) => /not modified/i.test(String(e?.message)) ? false : Promise.reject(e));
    if (ok) {
      edited.push(row.id);
      await audit("publisher", "telegram.round_link_updated", "ok", { ref: row.id });
    }
  }
  return edited;
}
