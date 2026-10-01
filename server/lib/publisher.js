// PUBLISHER: due queue items → guards → (owner review) → X / Telegram. One post per platform per tick.
import { alert, allSettings, audit, bump, recordCost } from "./core.js";
import { db } from "./db.js";
import { env, integrations } from "./env.js";
import { checkContent } from "./guards.js";
import { conditionsMet, context, render } from "./queue.js";
import { chatFromLink, messageUrl, notifyOwner, publishTelegram } from "./telegram.js";
import { publishX, xReady } from "./x.js";

const MEDIA_DIRS = /^content\/(mascot|memes|animations)\//;
export const mediaUrl = (asset) => (asset && MEDIA_DIRS.test(asset) ? `${env.siteUrl}/media/${asset.replace(/^content\//, "")}` : null);

// Late posts must not fire out of context: launch-relative posts expire 2 h after their slot, day posts after 72 h.
const windowMs = (slot) => (slot && /^T/.test(slot) ? 2 * 3600e3 : 72 * 3600e3);

async function capsOk(sql, platform, settings) {
  const cap = platform === "x" ? settings.limits.xPerDay : settings.limits.telegramPerDay;
  const [{ today }] = await sql`select count(*)::int as today from chek.queue where platform = ${platform} and status = 'published' and published_at > now() - interval '24 hours'`;
  const [{ last }] = await sql`select max(published_at) as last from chek.queue where platform = ${platform} and status = 'published'`;
  if (today >= cap) return `daily cap ${cap}`;
  if (last && Date.now() - new Date(last).getTime() < settings.limits.minGapMinutes * 60e3) return `gap < ${settings.limits.minGapMinutes} min`;
  return null;
}

export async function runPublisher(now = new Date()) {
  const settings = await allSettings();
  if (settings.autopilot === "off") return { autopilot: "off" };
  const sql = await db();
  const ctx = await context();
  const report = {};

  for (const platform of ["telegram", "x"]) {
    const configured = integrations()[platform] && (platform !== "x" || (await xReady()));
    const live = settings.autopilot === "on" && settings.platforms[platform] && configured;
    const due = await sql`select * from chek.queue where platform = ${platform} and status in ('ready','approved','review')
      and publish_after is not null and publish_after <= ${now} order by publish_after limit 20`;
    let published = null;

    for (const row of due) {
      if (now - new Date(row.publish_after) > windowMs(row.slot)) {
        await sql`update chek.queue set status = 'expired', updated_at = now() where id = ${row.id}`;
        await audit("publisher", "post.expired", "skip", { ref: row.id, detail: { slot: row.slot } });
        continue;
      }
      const missing = await conditionsMet(row, ctx);
      if (missing.length) continue; // waits silently; visible in the dashboard
      const out = render(row, ctx, now);
      if (out.missing.length) continue;

      const verdict = checkContent({ platform, parts: out.parts, origin: row.origin, level: row.level, ack: row.payload.ack });
      if (!verdict.ok) {
        await sql`update chek.queue set status = 'failed', last_error = ${verdict.problems.join("; ")}, updated_at = now() where id = ${row.id}`;
        await audit("publisher", "post.blocked_by_guard", "error", { ref: row.id, detail: { problems: verdict.problems } });
        await alert("warn", "guard_block", `Post ${row.id} blocked: ${verdict.problems.join("; ")}`, row.id);
        continue;
      }
      if (verdict.level === "review" && row.status !== "approved") {
        if (row.status !== "review") {
          await sql`update chek.queue set status = 'review', updated_at = now() where id = ${row.id}`;
          await audit("publisher", "post.needs_review", "info", { ref: row.id, detail: { problems: verdict.problems } });
          const owner = settings.owner?.telegramUserId;
          await notifyOwner(owner, `REVIEW ${row.id} (${platform})\n\n${out.parts.join("\n\n— — —\n\n")}\n\n${verdict.problems.join("\n")}`, [
            [
              { text: "✅ Publish", callback_data: `ap:${row.id}` },
              { text: "❌ Reject", callback_data: `rj:${row.id}` },
            ],
          ]).catch((e) => audit("publisher", "owner.notify", "error", { ref: row.id, error: e.message }));
        }
        continue;
      }
      if (published) continue; // one per platform per tick

      if (!live) {
        if (row.last_error !== "dry") {
          await sql`update chek.queue set last_error = 'dry', updated_at = now() where id = ${row.id}`;
          await audit("publisher", `post.would_publish.${platform}`, "dry", { ref: row.id, detail: { parts: out.parts, media: row.payload.asset ?? null } });
        }
        published = row.id;
        continue;
      }
      const cap = await capsOk(sql, platform, settings);
      if (cap) {
        await audit("publisher", "post.deferred", "skip", { ref: row.id, detail: { reason: cap } });
        break;
      }

      await sql`update chek.queue set status = 'publishing', attempts = attempts + 1, updated_at = now() where id = ${row.id}`;
      try {
        const img = row.payload.imageUrl;
        const media = img ? (img.startsWith("/") ? env.siteUrl + img : img) : mediaUrl(row.payload.asset);
        let ext;
        if (platform === "telegram") {
          const chat = row.payload.where === "chat" ? chatFromLink(ctx.project.links.telegramChat) : chatFromLink(ctx.project.links.telegram);
          const msg = await publishTelegram({ chat, parts: out.parts, mediaUrl: media, poll: row.payload.poll, pin: Boolean(row.payload.pin) });
          ext = { id: String(msg.message_id), url: messageUrl(chat, msg.message_id) };
        } else {
          ext = await publishX({ parts: out.parts, mediaUrl: media, poll: row.payload.poll });
          if (ext.cost) await recordCost("x_api", ext.calls, "requests", ext.cost, row.id);
          if (row.payload.pin) await alert("info", "x_pin", `Pin this post on X manually: ${ext.url}`, row.id);
        }
        await sql`update chek.queue set status = 'published', external_id = ${ext.id}, external_url = ${ext.url}, published_at = now(), last_error = null, updated_at = now() where id = ${row.id}`;
        await audit("publisher", `post.published.${platform}`, "ok", { ref: row.id, detail: { url: ext.url } });
        await bump(`posts_${platform}`);
        published = row.id;
      } catch (e) {
        const failed = row.attempts + 1 >= 3;
        await sql`update chek.queue set status = ${failed ? "failed" : "ready"}, last_error = ${e.message.slice(0, 500)}, updated_at = now() where id = ${row.id}`;
        await audit("publisher", `post.publish_failed.${platform}`, "error", { ref: row.id, error: e.message });
        if (failed) await alert("error", "post_failed", `Post ${row.id} failed 3 times on ${platform}: ${e.message}`, row.id);
        break;
      }
    }
    report[platform] = { live, published };
  }
  return report;
}

export async function decide(id, approve, by) {
  const sql = await db();
  const [row] = await sql`update chek.queue set status = ${approve ? "approved" : "rejected"}, approved_at = now(), approved_by = ${by}, updated_at = now()
    where id = ${id} and status in ('review','ready','failed') returning id, status`;
  await audit("owner", approve ? "post.approved" : "post.rejected", row ? "ok" : "skip", { ref: id, source: by });
  return row ?? null;
}
