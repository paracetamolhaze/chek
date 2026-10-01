// DRY RUN: the whole system runs for real (scheduler, agents, guards, approvals) but nothing is published.
// Every post it WOULD have published is logged with its exact text, media, source and reasons (chek.dry_log).
// Going live (autopilot=on) is refused until a full dry run has finished and the production audit is fresh.
import { fill, placeholders, SAMPLE } from "../../shared/content-core.mjs";
import { allSettings, audit, getSetting, setSetting } from "./core.js";
import { db } from "./db.js";
import { checkContent } from "./guards.js";
import { withLiveToken } from "./project.js";
import { context, render, reschedule, syncSeed } from "./queue.js";

const DRY_MIN_HOURS = 24;
const AUDIT_MAX_AGE_H = 6;

export async function liveGate(s = null) {
  s ||= await allSettings();
  const missing = [];
  const d = s.dry_run;
  if (!d?.startedAt) missing.push("no dry run yet");
  else if (Date.parse(d.endsAt) > Date.now()) missing.push(`dry run still running (ends ${d.endsAt})`);
  else if (Date.parse(d.endsAt) - Date.parse(d.startedAt) < DRY_MIN_HOURS * 3600e3) missing.push(`dry run shorter than ${DRY_MIN_HOURS} h`);
  const a = s.prod_audit;
  if (!a?.ok) missing.push("production audit not passing");
  else if (Date.now() - Date.parse(a.checkedAt) > AUDIT_MAX_AGE_H * 3600e3) missing.push(`production audit older than ${AUDIT_MAX_AGE_H} h`);
  if (!s.owner?.telegramUserId) missing.push("owner not linked in Telegram (approvals)");
  return { ok: missing.length === 0, missing };
}

export async function dryStart({ hours = 24, d1 = null } = {}) {
  const now = new Date();
  const id = `dry-${now.toISOString().slice(0, 16).replace(/[:T]/g, "")}`;
  const today = now.toISOString().slice(0, 10);
  await dryReset();
  const schedule = await getSetting("schedule");
  // the dry run plays day 1 of the calendar in real time, starting today
  await setSetting("schedule", { ...schedule, d1: d1 || today, launchedAt: null });
  await setSetting("dry_run", { id, startedAt: now.toISOString(), endsAt: new Date(now.getTime() + hours * 3600e3).toISOString(), d1: d1 || today, realD1: schedule.d1 });
  await setSetting("autopilot", "dry");
  const seeded = await syncSeed();
  await reschedule();
  // agents run on the next tick instead of waiting for their usual time
  const runs = (await getSetting("job_runs")) || {};
  for (const k of ["engine", "news_fetch", "news_eval", "tg_rights", "prod_audit"]) delete runs[k];
  await setSetting("job_runs", runs);
  await audit("owner", "dry_run.started", "ok", { detail: { id, hours } });
  return { ok: true, id, seeded, endsAt: new Date(now.getTime() + hours * 3600e3).toISOString() };
}

// Back to a clean queue: dry-published seed posts become ready again; one-off agent drafts from the run are retired.
export async function dryReset() {
  const sql = await db();
  const seed = await sql`update chek.queue set status = 'ready', dry_at = null, last_error = null, updated_at = now()
    where origin = 'seed' and status in ('dry_published','expired','failed') returning id`;
  const other = await sql`update chek.queue set status = 'skipped', last_error = 'dry run draft', updated_at = now()
    where origin <> 'seed' and status in ('dry_published','ready','review','approved','expired','failed') and created_at < now() returning id`;
  return { reset: seed.length, retired: other.length };
}

export async function dryReport(runId = null) {
  const s = await allSettings();
  const run = runId || s.dry_run?.id || "dry";
  const since = s.dry_run?.startedAt ?? new Date(Date.now() - 48 * 3600e3).toISOString();
  const until = s.dry_run?.endsAt ?? new Date().toISOString();
  const sql = await db();
  const log = await sql`select * from chek.dry_log where run = ${run} order by at`;
  const jobs = await sql`select id, kind, status, model, attempts, created_at, finished_at, error, left(result, 6000) as result, meta from chek.ai_jobs where created_at >= ${since} order by id`;
  const news = await sql`select id, source, title, url, published_at, score, status, reason, checked_at from chek.news_items where checked_at >= ${since} order by checked_at`;
  const alerts = await sql`select at, level, kind, message, ref from chek.alerts where at >= ${since} order by at`;
  const auditRows = await sql`select at, agent, action, result, ref, error from chek.audit_log where at >= ${since} and result in ('error','dry') order by at limit 500`;
  const upcoming = await sql`select * from chek.queue where status in ('ready','review','approved') order by publish_after nulls last, id`;

  // later calendar items, pre-checked now with sample values where the real ones don't exist yet (CA, launch time…)
  const ctx = await context();
  const values = placeholders(ctx.project, ctx.schedule, ctx.inputs);
  const sample = Object.fromEntries(Object.entries({ ...SAMPLE, ...values }).map(([k, v]) => [k, v ?? SAMPLE[k] ?? `[${k}]`]));
  const preview = upcoming.map((row) => {
    const real = render(row, ctx);
    const parts = row.payload.parts.map((t) => fill(t, sample).text);
    // post-launch items are checked as they will run: against a launched project with the sample CA
    const asProject = (row.requires || []).includes("live") && !ctx.ca ? withLiveToken(ctx.project, { ca: sample.CA, creatorWallet: sample.CREATOR }) : ctx.project;
    const v = checkContent({ platform: row.platform, parts, origin: row.origin, level: row.level, ack: row.payload.ack, allowMentions: row.payload.allowMentions, project: asProject });
    return {
      id: row.id,
      platform: row.platform,
      slot: row.slot,
      dueAt: row.publish_after,
      status: row.status,
      category: row.category,
      origin: row.origin,
      parts,
      sampleValues: real.missing,
      media: row.payload.imageUrl ? fill(row.payload.imageUrl, sample).text : row.payload.asset ?? null,
      guard: v.ok ? (v.level === "review" ? "REVIEW" : "OK") : "BLOCKED",
      problems: v.problems,
      why: row.payload.why ?? null,
    };
  });
  return { run, startedAt: s.dry_run?.startedAt ?? null, endsAt: until, autopilot: s.autopilot, log, jobs, news, alerts, audit: auditRows, preview, gate: await liveGate(s) };
}
