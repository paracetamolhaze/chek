// AI layer. Two transports, same contract (zod-validated JSON):
//   agent (default) — the cloud queues the prompt in chek.ai_jobs; the owner's PC agent (agent/run.mjs) runs it through
//                     Claude Code on the owner's subscription and returns the text. No AI key in the cloud, $0 per call.
//                     If the PC is off, jobs expire and the day simply has fewer authored posts.
//   api             — only if ANTHROPIC_API_KEY is set: direct Claude API call, metered and budget-guarded.
// Handlers that apply a result live with their agent (engine.js, news.js); ai-jobs.js maps job kinds to them.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { audit, getSetting, recordCost, withinBudget } from "./core.js";
import { db } from "./db.js";
import { env } from "./env.js";

export const DEFAULT_MODEL = "claude-opus-5-5";

// $ per million tokens (input, output, cache read) for the API transport. Keep in sync with the provider's price list.
const PRICES = {
  "claude-opus-5-5": [4, 20, 0.2],
  "claude-sonnet-5-5": [2, 10, 0.2],
  "claude-haiku-4-5": [1, 5, 0.1],
};

let client = null;
const anthropic = () => (client ||= new Anthropic({ apiKey: env.anthropicKey, maxRetries: 2, timeout: 120_000 }));

export async function aiTransport() {
  if (env.anthropicKey) return "api";
  const ai = (await getSetting("ai")) || {};
  return ai.transport === "off" ? null : "agent";
}

// The PC agent checks in on every poll; "online" = seen in the last 20 minutes.
export async function agentStatus() {
  const seen = await getSetting("agent_seen");
  const at = seen?.at ? Date.parse(seen.at) : 0;
  return { online: Boolean(at) && Date.now() - at < 20 * 60e3, ai: seen?.ai !== false, lastSeen: seen?.at ?? null, host: seen?.host ?? null };
}

export function jsonInstruction(schema) {
  return `OUTPUT FORMAT\nReturn exactly one JSON document that validates against this JSON Schema. No prose before or after it, no markdown fence.\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

// Lenient JSON extraction for CLI output: strips fences / stray prose around one object.
export function parseJsonLoose(text) {
  const s = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object in the answer");
  return JSON.parse(s.slice(a, b + 1));
}

/**
 * Ask Claude for a JSON object matching `schema`, then apply it.
 * api: runs now and calls onResult(parsed, meta). agent: queues a job; ai-jobs.js applies it when the PC answers.
 * @returns {Promise<{mode:string, jobId?:number, result?:any, skipped?:string}>}
 */
export async function ask({ kind, schema, system, prompt, meta = {}, effort = "low", maxTokens = 8000, ttlMin = 360, onResult }) {
  const transport = await aiTransport();
  if (!transport) return { skipped: "ai off" };
  if (transport === "api") {
    const out = await structured({ agent: kind, schema, system, prompt, effort, maxTokens });
    if (!out) return { mode: "api", skipped: "no result" };
    return { mode: "api", result: await onResult(out, meta) };
  }
  const sql = await db();
  const ai = (await getSetting("ai")) || {};
  const [row] = await sql`insert into chek.ai_jobs (kind, model, system, prompt, meta, expires_at)
    values (${kind}, ${ai.model || DEFAULT_MODEL}, ${`${system}\n\n${jsonInstruction(schema)}`}, ${prompt}, ${sql.json(meta)}, now() + make_interval(mins => ${ttlMin}))
    returning id`;
  await audit(kind, "ai.job_queued", "info", { ref: String(row.id), detail: { meta } });
  return { mode: "agent", jobId: row.id };
}

/** API transport: structured output, refusal handling, cost accounting, budget guard. Returns null when skipped. */
export async function structured({ agent, schema, system, prompt, effort = "low", maxTokens = 8000 }) {
  if (!env.anthropicKey) return null;
  if (!(await withinBudget("ai_api"))) return null;
  const ai = (await getSetting("ai")) || {};
  const model = ai.model || DEFAULT_MODEL;
  try {
    const res = await anthropic().beta.messages.parse({
      model,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a policy decline is retried server-side on a suitable model
      cache_control: { type: "ephemeral" },
      system,
      output_config: { effort, format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: prompt }],
    });
    const u = res.usage;
    const [pin, pout, pcache] = PRICES[res.model] || PRICES[model] || PRICES[DEFAULT_MODEL];
    const usd = ((u.input_tokens ?? 0) * pin + (u.output_tokens ?? 0) * pout + (u.cache_read_input_tokens ?? 0) * pcache + (u.cache_creation_input_tokens ?? 0) * pin * 1.25) / 1e6;
    await recordCost("ai_api", (u.input_tokens ?? 0) + (u.output_tokens ?? 0), "tokens", usd, agent);
    if (res.stop_reason === "refusal") {
      await audit(agent, "ai.refused", "skip", { detail: { category: res.stop_details?.category ?? null } });
      return null;
    }
    if (res.stop_reason === "max_tokens" || !res.parsed_output) {
      await audit(agent, "ai.unparsed", "error", { detail: { stop: res.stop_reason } });
      return null;
    }
    return res.parsed_output;
  } catch (e) {
    const kind = e instanceof Anthropic.RateLimitError ? "rate_limited" : e instanceof Anthropic.AuthenticationError ? "auth" : e instanceof Anthropic.APIError ? `api_${e.status}` : "network";
    await audit(agent, `ai.error.${kind}`, "error", { error: e.message });
    return null;
  }
}
