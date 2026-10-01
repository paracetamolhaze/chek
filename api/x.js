// X OAuth: the owner opens a short-lived signed link from the dashboard while logged in as the project account.
import { audit, getSetting, setSetting } from "../server/lib/core.js";
import { db } from "../server/lib/db.js";
import { handle, safeEqual, sign } from "../server/lib/http.js";
import { reschedule } from "../server/lib/queue.js";
import { authorizeUrl, handleCallback } from "../server/lib/x.js";

const page = (title, body) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><body style="font:16px ui-monospace,monospace;background:#141311;color:#f4f0e6;padding:40px"><h1>🧾 ${title}</h1><p>${body}</p>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });

export async function GET(request) {
  return handle(async () => {
    const q = new URL(request.url).searchParams;
    if (q.get("op") === "connect") {
      const exp = q.get("e");
      if (!exp || Date.now() > Number(exp) || !safeEqual(q.get("s"), sign(`xconnect:${exp}`))) return page("Link expired", "Open a fresh link from the dashboard.");
      return Response.redirect(authorizeUrl(), 302);
    }
    if (q.get("op") === "callback") {
      if (q.get("error")) return page("Not connected", "X returned an error. Try again from the dashboard.");
      const user = await handleCallback(q.get("code"), q.get("state"));
      const platforms = await getSetting("platforms");
      await setSetting("platforms", { ...platforms, x: true });
      // Day 1 of the X schedule = the day the account actually starts posting (never backdated).
      const sql = await db();
      const [{ n }] = await sql`select count(*)::int as n from chek.queue where platform = 'x' and status = 'published'`;
      if (n === 0) {
        const s = await getSetting("schedule");
        const today = new Date().toISOString().slice(0, 10);
        if (s.d1 < today) {
          await setSetting("schedule", { ...s, d1: today });
          await reschedule();
        }
      }
      await audit("owner", "x.platform_enabled", "ok", { detail: { username: user?.username } });
      return page("X connected", `Posting as @${user?.username ?? "?"}. You can close this tab.`);
    }
    return page("CHEK", "Nothing here.");
  });
}
