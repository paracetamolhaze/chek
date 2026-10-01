// AI JOBS: the bridge between the cloud and the owner's PC agent (agent/run.mjs).
// The cloud never holds an AI key: it queues prompts, the PC agent runs them through Claude Code on the owner's
// subscription and posts the text back here. Every answer is parsed and zod-validated before anything is applied.
import { audit, bump, recordCost, setSetting } from "./core.js";
import { db } from "./db.js";
import { Plan, applyPlan } from "./engine.js";
import { parseJsonLoose } from "./llm.js";
import { Verdict, applyVerdict } from "./news.js";

const KINDS = {
  engine_plan: { schema: Plan, apply: applyPlan },
  news_verdict: { schema: Verdict, apply: applyVerdict },
};

const STUCK_MIN = 12; // a claimed job with no answer after this goes back to the queue (PC slept, CLI crashed)
const MAX_ATTEMPTS = 2;

export async function expireJobs() {
  const sql = await db();
  const expired = await sql`update chek.ai_jobs set status = 'expired', finished_at = now()
    where status in ('queued','running') and expires_at < now() returning id, kind`;
  await sql`update chek.ai_jobs set status = case when attempts >= ${MAX_ATTEMPTS} then 'failed' else 'queued' end,
      error = coalesce(error, '') || ' [no answer — requeued]'
    where status = 'running' and claimed_at < now() - make_interval(mins => ${STUCK_MIN})`;
  // news items whose verdict never came back can be tried again later
  for (const j of expired) if (j.kind === "news_verdict") await sql`update chek.news_items set status = 'new' where status = 'candidate' and id in (select (meta->>'newsId')::bigint from chek.ai_jobs where id = ${j.id})`;
  if (expired.length) await audit("agent", "ai.jobs_expired", "skip", { detail: { ids: expired.map((j) => Number(j.id)) } });
  return expired.length;
}

/** PC agent asks for work. Records the heartbeat; returns one job or null. */
export async function claimJob(host, { noai = false } = {}) {
  await setSetting("agent_seen", { at: new Date().toISOString(), host: String(host || "pc").slice(0, 40), ai: !noai });
  await expireJobs();
  if (noai) return null;
  const sql = await db();
  const [job] = await sql`update chek.ai_jobs set status = 'running', claimed_at = now(), attempts = attempts + 1
    where id = (select id from chek.ai_jobs where status = 'queued' and expires_at > now() order by created_at limit 1 for update skip locked)
    returning id, kind, model, system, prompt`;
  return job ? { id: Number(job.id), kind: job.kind, model: job.model, system: job.system, prompt: job.prompt } : null;
}

/** PC agent returns Claude's text. Parse → validate → apply. */
export async function completeJob(id, text, info = {}) {
  const sql = await db();
  const [job] = await sql`select * from chek.ai_jobs where id = ${id} and status = 'running'`;
  if (!job) return { ok: false, error: "job not running" };
  const kind = KINDS[job.kind];
  let parsed;
  try {
    parsed = kind.schema.parse(parseJsonLoose(text));
  } catch (e) {
    const retry = job.attempts < MAX_ATTEMPTS;
    await sql`update chek.ai_jobs set status = ${retry ? "queued" : "failed"}, result = ${String(text).slice(0, 20000)}, error = ${`invalid answer: ${e.message}`.slice(0, 1000)} where id = ${id}`;
    await audit(job.kind, "ai.answer_invalid", "error", { ref: String(id), error: e.message.slice(0, 500) });
    return { ok: false, error: "invalid answer", retry };
  }
  const outcome = await kind.apply(parsed, job.meta);
  await sql`update chek.ai_jobs set status = 'done', result = ${String(text).slice(0, 20000)}, finished_at = now(), error = null where id = ${id}`;
  // subscription runs cost $0; tokens are still recorded so the owner sees the volume
  await recordCost("ai_api", Number(info.inputTokens || 0) + Number(info.outputTokens || 0), "tokens", 0, `subscription:${job.kind}`);
  await bump("ai_jobs_done");
  await audit(job.kind, "ai.job_done", "ok", { ref: String(id), detail: { model: info.model ?? job.model, outcome } });
  return { ok: true, outcome };
}

export async function failJob(id, error) {
  const sql = await db();
  const [job] = await sql`select attempts from chek.ai_jobs where id = ${id} and status = 'running'`;
  if (!job) return { ok: false };
  const retry = job.attempts < MAX_ATTEMPTS && !/limit|login/i.test(error || "");
  await sql`update chek.ai_jobs set status = ${retry ? "queued" : "failed"}, error = ${String(error).slice(0, 1000)}, finished_at = case when ${retry} then null else now() end where id = ${id}`;
  await audit("agent", "ai.job_failed", "error", { ref: String(id), error: String(error).slice(0, 500) });
  return { ok: true, retry };
}
