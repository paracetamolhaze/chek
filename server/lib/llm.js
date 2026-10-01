// Claude API wrapper: structured output, refusal handling, cost accounting, budget guard.
// Model and effort are settings (default per Anthropic guidance: claude-opus-5-5); the owner can switch them to cut cost.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { audit, getSetting, recordCost, withinBudget } from "./core.js";
import { env } from "./env.js";

// $ per million tokens (input, output, cache read). Keep in sync with the provider's price list.
const PRICES = {
  "claude-opus-5-5": [4, 20, 0.2],
  "claude-sonnet-5-5": [2, 10, 0.2],
  "claude-haiku-4-5": [1, 5, 0.1],
};

let client = null;
const anthropic = () => (client ||= new Anthropic({ apiKey: env.anthropicKey, maxRetries: 2, timeout: 120_000 }));

export const aiReady = () => Boolean(env.anthropicKey);

/**
 * Ask Claude for a JSON object matching a zod schema. Returns null when skipped (no key, budget, refusal).
 * @param {{agent:string, schema:import("zod").ZodType, system:string, prompt:string, effort?:"low"|"medium"|"high", maxTokens?:number}} o
 */
export async function structured({ agent, schema, system, prompt, effort = "low", maxTokens = 8000 }) {
  if (!aiReady()) return null;
  if (!(await withinBudget("ai_api"))) return null;
  const ai = (await getSetting("ai")) || {};
  const model = ai.model || "claude-opus-5-5";
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
    const [pin, pout, pcache] = PRICES[res.model] || PRICES[model] || PRICES["claude-opus-5-5"];
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
