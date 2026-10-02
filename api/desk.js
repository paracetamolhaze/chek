// Private X desk for the owner's ChatGPT agent (x_transport "desk"). The agent opens this page (secret key in the URL),
// posts what it shows on x.com, and sends back the link of the post it made. Threads go part by part.
// Nothing here posts by itself: it only shows the queued post and records the link the agent returns.
import { getSetting } from "../server/lib/core.js";
import { db } from "../server/lib/db.js";
import { env } from "../server/lib/env.js";
import { safeEqual } from "../server/lib/http.js";
import { refreshRoundLinks } from "../server/lib/roundlinks.js";
import { notifyOwner } from "../server/lib/telegram.js";
import { confirmPosted, deskKey, tweetIdOf } from "../server/lib/xhandoff.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const intent = (text, replyTo) => `https://x.com/intent/post?${new URLSearchParams({ text, ...(replyTo ? { in_reply_to: replyTo } : {}) })}`;
const page = (body) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>CHEK X desk</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;background:#fff;color:#111}pre{white-space:pre-wrap;background:#f4f0e6;border:2px solid #111;padding:14px;font:15px/1.45 ui-monospace,monospace}
input{font:16px system-ui;padding:10px;width:100%;box-sizing:border-box;border:2px solid #111}button{font:700 15px system-ui;padding:10px 18px;margin-top:8px;background:#111;color:#fff;border:0;cursor:pointer}
.box{border:2px solid #111;padding:14px;margin:16px 0}.muted{color:#666;font-size:14px}a{color:#0645ad}</style></head><body>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );

async function current() {
  const sql = await db();
  const [row] = await sql`select * from chek.queue where platform = 'x' and status = 'publishing' and payload->'handoff'->>'via' = 'desk' order by updated_at limit 1`;
  return row ?? null;
}

export async function GET(request) {
  const url = new URL(request.url);
  const k = url.searchParams.get("k") || "";
  if (!env.appSecret || !safeEqual(k, deskKey())) return new Response("not found", { status: 404 });
  let note = "";

  // the agent reports the link of the post it just made
  const doneId = url.searchParams.get("id");
  const link = url.searchParams.get("link");
  if (doneId && link) {
    if (!tweetIdOf(link)) note = `<p style="color:#b00"><b>That isn't a link to a post on x.com.</b> Open the post you made, copy its link (it contains /status/), and paste it again.</p>`;
    else {
      const r = await confirmPosted(doneId, link.trim(), null);
      if (!r.ok) note = `<p style="color:#b00"><b>${esc(doneId)} isn't waiting any more</b> (already recorded, or handed to the owner). Do not post it again.</p>`;
      else if (r.published) {
        note = `<p><b>✅ ${esc(doneId)} recorded as posted.</b></p>`;
        const owner = (await getSetting("owner"))?.telegramUserId;
        await notifyOwner(owner, `✅ GPT posted ${doneId} on X: ${link.trim()}`).catch(() => {});
        if (/^xg-/.test(doneId)) await refreshRoundLinks().catch(() => {});
      } else note = `<p><b>Part recorded.</b> Now post the next part below, as a reply to the post you just made.</p>`;
    }
  }

  const row = await current();
  if (!row) {
    const sql = await db();
    const next = await sql`select id, publish_after from chek.queue where platform = 'x' and status in ('ready','approved') and publish_after is not null order by publish_after limit 3`;
    // X posts are spaced (minGapMinutes) and nothing goes out at night: say exactly when the next one shows up here
    const s = await getSetting("limits");
    const [last] = await sql`select max(published_at) as at from chek.queue where platform = 'x' and status = 'published'`;
    const gapEnd = last?.at ? new Date(new Date(last.at).getTime() + (s?.minGapMinutes ?? 55) * 60e3) : new Date(0);
    const at = (d) => new Date(d).toISOString().slice(11, 16) + " UTC";
    const first = next[0];
    const when = first ? new Date(Math.max(new Date(first.publish_after).getTime(), gapEnd.getTime())) : null;
    const mins = when ? Math.max(0, Math.ceil((when.getTime() - Date.now()) / 60e3) + 5) : null; // + the 5-min scheduler tick
    return page(
      `<h1>CHEK X desk</h1>${note}<p><b>Nothing to post right now.</b> Do not post anything from memory or old copies.</p>
${first ? `<p><b>Next: ${esc(first.id)}</b> shows up here at about ${esc(at(when.getTime() + 5 * 60e3))} (in ~${mins} min). Come back then.</p>` : ""}
<p class="muted">Upcoming (scheduled time, UTC): ${next.map((n) => `${esc(n.id)} at ${esc(at(n.publish_after))}`).join(", ") || "none scheduled"}. Posts are spaced ${s?.minGapMinutes ?? 55} min apart; the owner's night hours also delay them.</p>`,
    );
  }

  const h = row.payload.handoff;
  const i = h.part;
  const text = h.parts[i];
  const replyTo = i > 0 ? h.links[i - 1] : null;
  const self = (extra) => `/api/desk?${new URLSearchParams({ k, ...extra })}`;
  return page(`<h1>CHEK X desk</h1>${note}
<div class="box"><p><b>Post ${esc(row.id)}${h.parts.length > 1 ? ` · part ${i + 1} of ${h.parts.length}` : ""}</b>${row.payload.pin && i === 0 ? " · <b>pin it on the profile after posting</b>" : ""}</p>
${replyTo ? `<p><b>This part is a REPLY</b> to the post you made a moment ago: <a href="https://x.com/i/status/${esc(replyTo)}">https://x.com/i/status/${esc(replyTo)}</a></p>` : ""}
<p>Text, exactly as is (do not change, add or remove anything):</p>
<pre id="t">${esc(text)}</pre>
<p><a href="${esc(intent(text, replyTo))}">Open X with this text pre-filled${replyTo ? " as a reply" : ""}</a></p>
${h.media && i === 0 ? `<p><b>Attach this ${/\.mp4($|\?)/i.test(h.media) ? "video" : "picture"}</b> to the post (download it, then add it in the X composer): <a href="${esc(h.media)}">${esc(h.media)}</a></p>` : `<p class="muted">No media for this part.</p>`}
</div>
<form method="get" action="/api/desk" class="box"><input type="hidden" name="k" value="${esc(k)}"><input type="hidden" name="id" value="${esc(row.id)}">
<label for="link"><b>After posting:</b> paste the link of the post you just made (it contains /status/)</label><br>
<input id="link" name="link" placeholder="https://x.com/chekcoinsol/status/..." autocomplete="off"><br><button type="submit">Posted</button></form>
<p class="muted">Then reload <a href="${esc(self({}))}">this page</a> for the next part or post. If something looks wrong, don't post it, tell the owner.</p>`);
}
