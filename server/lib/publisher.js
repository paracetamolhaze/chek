// PUBLISHER: due queue items → guards → (owner review) → X / Telegram. One post per platform per tick.
// autopilot = off  → nothing runs
//             dry  → everything runs exactly as live, but instead of posting, the item is marked dry_published and the
//                    full post (text, media, source, reasons) is written to chek.dry_log for the dry-run report
//             on   → live; a platform that is not connected yet simply keeps its posts waiting
import { alert, allSettings, audit, bump, recordCost } from "./core.js";
import { db } from "./db.js";
import { env, integrations } from "./env.js";
import { checkContent } from "./guards.js";
import { conditionsMet, context, render } from "./queue.js";
import { chatFromLink, messageUrl, notifyOwner, publishTelegram } from "./telegram.js";
import { publishX, xReady } from "./x.js";
import { handoffX, ownerAwake } from "./xhandoff.js";

const MEDIA_DIRS = /^content\/(mascot|memes|animations|shorts)\//;
// ?v=<deployment>: Telegram caches files fetched by URL, so a re-rendered video would otherwise arrive in its old version
const MEDIA_V = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || "";
export const mediaUrl = (asset) =>
  asset && MEDIA_DIRS.test(asset) ? `${env.siteUrl}/media/${asset.replace(/^content\//, "")}${MEDIA_V ? `?v=${encodeURIComponent(MEDIA_V)}` : ""}` : null;
const mediaOf = (row, out = null) => {
  const raw = out ? out.imageUrl : row.payload.imageUrl;
  const img = raw && !raw.includes("{{") ? raw : null;
  return img ? (img.startsWith("/") ? env.siteUrl + img : img) : mediaUrl(row.payload.asset);
};

// Late posts must not fire out of context: launch-relative posts expire 2 h after their slot, day posts after 72 h.
const windowMs = (slot) => (slot && /^T/.test(slot) ? 2 * 3600e3 : 72 * 3600e3);

async function capsOk(sql, platform, settings, dry) {
  const cap = platform === "x" ? settings.limits.xPerDay : settings.limits.telegramPerDay;
  const [c] = dry
    ? await sql`select count(*) filter (where dry_at > now() - interval '24 hours')::int as today, max(dry_at) as last from chek.queue where platform = ${platform} and status = 'dry_published'`
    : await sql`select count(*) filter (where published_at > now() - interval '24 hours')::int as today, max(published_at) as last from chek.queue where platform = ${platform} and status = 'published'`;
  if (c.today >= cap) return `daily cap ${cap}`;
  if (c.last && Date.now() - new Date(c.last).getTime() < settings.limits.minGapMinutes * 60e3) return `gap < ${settings.limits.minGapMinutes} min`;
  return null;
}

// opts.ids / opts.platforms: the launch op publishes exactly its own items, X first, then Telegram.
export async function runPublisher(now = new Date(), { ids = null, platforms = ["telegram", "x"] } = {}) {
  const settings = await allSettings();
  if (settings.autopilot === "off") return { autopilot: "off" };
  const sql = await db();
  const ctx = await context();
  const dry = settings.autopilot === "dry";
  // live posting needs a fresh, passing production audit (no stale claims on the site the posts point to)
  if (!dry && !ids) {
    const pa = settings.prod_audit;
    if (!pa?.ok || Date.now() - Date.parse(pa.checkedAt) > 24 * 3600e3) {
      await alert("error", "live_blocked_audit", "Live posting paused: the production audit is failing or older than 24 h.");
      return { blocked: "production audit" };
    }
  }
  const run = settings.dry_run?.id || "dry";
  const report = {};

  // dry-run journal: one line per (item, verdict) and run
  const log = (row, verdict, { parts = null, reasons = [], out = null } = {}) =>
    dry
      ? sql`insert into chek.dry_log (run, queue_id, platform, verdict, due_at, slot, level, origin, category, parts, media, source, reasons)
          values (${run}, ${row.id}, ${row.platform}, ${verdict}, ${row.publish_after}, ${row.slot}, ${row.level}, ${row.origin}, ${row.category},
            ${parts ? sql.json(parts) : null}, ${mediaOf(row, out)}, ${row.source ? sql.json(row.source) : null}, ${sql.json(reasons)})
          on conflict (run, queue_id, verdict) do nothing`
      : null;

  // X goes out through the official API when its keys are connected, otherwise via the owner's Telegram (one tap per post)
  const xTransport = settings.x_transport || (integrations().x ? "api" : "telegram");
  for (const platform of platforms) {
    const configured =
      platform === "x" && ["telegram", "desk"].includes(xTransport) ? Boolean(integrations().telegram && settings.owner?.telegramUserId) : integrations()[platform] && (platform !== "x" || (await xReady()));
    const live = !dry && settings.platforms[platform] && configured;
    if (!dry && !live) {
      report[platform] = { live: false, waiting: "platform not connected" };
      continue;
    }
    const due = ids
      ? await sql`select * from chek.queue where platform = ${platform} and id in ${sql(ids)} and status in ('ready','approved','review') and publish_after <= ${now}`
      : await sql`select * from chek.queue where platform = ${platform} and status in ('ready','approved','review')
      and publish_after is not null and publish_after <= ${now} order by publish_after limit 20`;
    let published = null;

    for (const row of due) {
      if (now - new Date(row.publish_after) > windowMs(row.slot)) {
        await sql`update chek.queue set status = 'expired', updated_at = now() where id = ${row.id}`;
        await audit("publisher", "post.expired", "skip", { ref: row.id, detail: { slot: row.slot } });
        await log(row, "expired", { reasons: [`not published within ${windowMs(row.slot) / 3600e3} h of its slot`] });
        continue;
      }
      const missing = await conditionsMet(row, ctx);
      const out = missing.length ? null : render(row, ctx, now);
      if (missing.length || out.missing.length) {
        await log(row, "waiting", { reasons: (missing.length ? missing : out.missing).map((m) => `waits for ${m}`) });
        continue; // waits silently; visible in the dashboard
      }

      const verdict = checkContent({ platform, parts: out.parts, origin: row.origin, level: row.level, ack: row.payload.ack, allowMentions: row.payload.allowMentions, project: ctx.project });
      if (!verdict.ok) {
        await sql`update chek.queue set status = 'failed', last_error = ${verdict.problems.join("; ")}, updated_at = now() where id = ${row.id}`;
        await audit("publisher", "post.blocked_by_guard", "error", { ref: row.id, detail: { problems: verdict.problems } });
        await log(row, "rejected", { parts: out.parts, reasons: verdict.problems, out });
        await alert("warn", "guard_block", `${dry ? "[dry run] " : ""}Post ${row.id} blocked: ${verdict.problems.join("; ")}`, row.id);
        continue;
      }
      if (verdict.level === "review" && row.status !== "approved") {
        if (row.status !== "review" && !ownerAwake(settings, now)) continue; // ask the owner in the morning, not at night
        if (row.status !== "review") {
          await sql`update chek.queue set status = 'review', updated_at = now() where id = ${row.id}`;
          await audit("publisher", "post.needs_review", "info", { ref: row.id, detail: { problems: verdict.problems } });
          await log(row, "review", { parts: out.parts, reasons: verdict.problems, out });
          const media = mediaOf(row, out);
          await notifyOwner(settings.owner?.telegramUserId, `${dry ? "[DRY RUN — nothing will be posted] " : ""}REVIEW ${row.id} (${platform})\n\n${out.parts.join("\n\n— — —\n\n")}${media ? `\n\n🖼 ${media}` : ""}\n\n${verdict.problems.join("\n")}`, [
            [
              { text: "✅ Publish", callback_data: `ap:${row.id}` },
              { text: "❌ Reject", callback_data: `rj:${row.id}` },
            ],
          ]).catch((e) => audit("publisher", "owner.notify", "error", { ref: row.id, error: e.message }));
        }
        continue;
      }
      if (published) continue; // one per platform per tick

      if (!row.payload.launch) {
        const cap = await capsOk(sql, platform, settings, dry);
        if (cap) {
          await audit("publisher", "post.deferred", "skip", { ref: row.id, detail: { reason: cap } });
          break;
        }
      }

      if (dry) {
        await sql`update chek.queue set status = 'dry_published', dry_at = now(), last_error = null, updated_at = now() where id = ${row.id}`;
        const reasons = [row.payload.why, row.status === "approved" ? `approved by the owner (${row.approved_by})` : null, ...verdict.problems].filter(Boolean);
        await log(row, "would_publish", { parts: out.parts, reasons, out });
        await audit("publisher", `post.would_publish.${platform}`, "dry", { ref: row.id });
        published = row.id;
        continue;
      }

      if (platform === "x" && ["telegram", "desk"].includes(xTransport)) {
        if (await handoffX(row, out, mediaOf(row, out), settings)) published = row.id;
        break; // one hand-over at a time; the next one goes after the owner posted (or skipped) this one
      }

      await sql`update chek.queue set status = 'publishing', attempts = attempts + 1, updated_at = now() where id = ${row.id}`;
      try {
        const media = mediaOf(row, out);
        let ext;
        if (platform === "telegram") {
          const chat = row.payload.where === "chat" ? chatFromLink(ctx.project.links.telegramChat) : chatFromLink(ctx.project.links.telegram);
          const msg = await publishTelegram({ chat, parts: out.parts, mediaUrl: media, poll: row.payload.poll, pin: Boolean(row.payload.pin) });
          ext = { id: String(msg.message_id), url: messageUrl(chat, msg.message_id) };
        } else {
          ext = await publishX({ parts: out.parts, mediaUrl: media, poll: row.payload.poll, replyTo: row.payload.replyTo, quoteOf: row.payload.quoteOf });
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
    report[platform] = { live, dry, published, ...(platform === "x" ? { via: xTransport } : {}) };
  }
  return report;
}

export async function decide(id, approve, by) {
  const sql = await db();
  const [row] = await sql`update chek.queue set status = ${approve ? "approved" : "rejected"}, approved_at = now(), approved_by = ${by}, updated_at = now()
    where id = ${id} and status in ('review','ready','failed') returning id, status, platform`;
  await audit("owner", approve ? "post.approved" : "post.rejected", row ? "ok" : "skip", { ref: id, source: by });
  const s = await allSettings();
  if (row && s.autopilot === "dry") {
    await sql`insert into chek.dry_log (run, queue_id, platform, verdict, reasons)
      values (${s.dry_run?.id || "dry"}, ${id}, ${row.platform}, ${approve ? "approved" : "rejected"}, ${sql.json([`owner ${approve ? "approved" : "rejected"} via ${by}`])})
      on conflict (run, queue_id, verdict) do nothing`;
  }
  return row ?? null;
}
