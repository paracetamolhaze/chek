// PC agent endpoint (agent/run.mjs on the owner's computer). Auth: AGENT_TOKEN (bearer) — it can take AI jobs and hand
// back answers (validated before use) and report a detected launch; it cannot change settings or read anything else.
//   GET  /api/agent?op=claim&host=…   → { job, launch: { armed, creatorWallet } }
//   POST /api/agent { op: "result", id, text, usage, model } | { op: "fail", id, error }
//   POST /api/agent { op: "launch_detected", ca }  → the server re-verifies everything on-chain itself (creator wallet,
//        symbol, authorities) before anything is published, so this token can never make it announce a wrong coin.
import { waitUntil } from "@vercel/functions";
import { claimJob, completeJob, failJob } from "../server/lib/ai-jobs.js";
import { AppError, handle, json, readJson, safeEqual } from "../server/lib/http.js";
import { confirmLaunch, launchWatch } from "../server/lib/launch.js";
import { runProdAudit } from "../server/lib/prodcheck.js";

export const maxDuration = 120; // live channel replies wait 20–60 s in the background

function requireAgent(request) {
  const token = process.env.AGENT_TOKEN;
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !safeEqual(got, token)) throw new AppError(401, "unauthorized");
}

export async function GET(request) {
  return handle(async () => {
    requireAgent(request);
    const q = new URL(request.url).searchParams;
    if (q.get("op") !== "claim") throw new AppError(400, "unknown op");
    return json({ job: await claimJob(q.get("host"), { noai: q.get("noai") === "1" }), launch: await launchWatch() });
  });
}

export async function POST(request) {
  return handle(async () => {
    requireAgent(request);
    const b = await readJson(request);
    if (b.op === "launch_detected") {
      if (typeof b.ca !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(b.ca)) throw new AppError(400, "bad CA");
      return json(await confirmLaunch(b.ca, "launch watcher"));
    }
    if (b.op === "prod_audit") return json(await runProdAudit());
    const id = Number(b.id);
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "bad id");
    if (b.op === "result") {
      if (typeof b.text !== "string" || b.text.length > 200_000) throw new AppError(400, "bad text");
      const r = await completeJob(id, b.text, { ...(b.usage || {}), model: b.model });
      // live channel replies go out 20–60 s after the person wrote, in the background (typing first)
      if (typeof r.outcome?.send === "function") {
        waitUntil(r.outcome.send().catch(() => {}));
        return json({ ...r, outcome: { sending: true } });
      }
      return json(r);
    }
    if (b.op === "fail") return json(await failJob(id, String(b.error || "unknown")));
    throw new AppError(400, "unknown op");
  });
}
