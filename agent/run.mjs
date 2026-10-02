// CHEK PC agent — runs on the owner's Windows PC (started hidden at logon by agent/watch.ps1).
// 1. AI writer: takes queued AI jobs from production (/api/agent), runs them through Claude Code on the owner's
//    subscription (a local Claude bridge: CLI in print mode, no tools, empty working dir,
//    allow-listed environment so an API key can never turn it into a paid run), and returns the text.
// 2. Launch watcher: from T-2h (or when armed) watches the announced creator wallet; the moment its pump.fun create
//    transaction is confirmed it reports the mint (production re-verifies everything on-chain and publishes),
//    then rebuilds and redeploys the static site with the verified facts.
// It holds no wallet keys and never signs anything. Config: private/.env.local (git-ignored).
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findCreation, inspectMint } from "../shared/solana-inspect.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRIVATE = join(ROOT, "private");
const env = Object.fromEntries(
  (existsSync(join(PRIVATE, ".env.local")) ? readFileSync(join(PRIVATE, ".env.local"), "utf8") : "")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const SITE = (env.CHEK_SITE || JSON.parse(readFileSync(join(ROOT, "config/project.json"), "utf8")).links.website).replace(/\/$/, "");
const TOKEN = env.AGENT_TOKEN;
const CLI = env.CHEK_CLAUDE_CLI || "C:/nvm4w/nodejs/node_modules/@anthropic-ai/claude-code/cli.js";
const GIT_BASH = env.CHEK_GIT_BASH || "D:\\Git\\bin\\bash.exe";
const RUN_MS = 6 * 60e3;
// Claude access, first match wins (no key is ever sent to the cloud):
//   bridge — a local Claude bridge already running on this PC (CLAUDE_BRIDGE_URL + CLAUDE_BRIDGE_TOKEN)
//   cli    — Claude Code in print mode with a subscription token from `claude setup-token` (CLAUDE_CODE_OAUTH_TOKEN)
const BRIDGE_URL = env.CLAUDE_BRIDGE_URL || "http://127.0.0.1:43131";
const MODE = env.CLAUDE_BRIDGE_TOKEN ? "bridge" : env.CLAUDE_CODE_OAUTH_TOKEN ? "cli" : null;
const LOG = join(PRIVATE, "agent.log");
const PID = join(PRIVATE, "agent.pid");

function log(...a) {
  const line = `${new Date().toISOString()} ${a.join(" ")}\n`;
  try {
    if (existsSync(LOG) && statSync(LOG).size > 2e6) writeFileSync(LOG, "");
    appendFileSync(LOG, line);
  } catch {}
  process.stdout.write(line);
}

// one instance only
if (existsSync(PID)) {
  const old = Number(readFileSync(PID, "utf8"));
  try {
    if (old && old !== process.pid) {
      process.kill(old, 0);
      console.log(`agent already running (pid ${old})`);
      process.exit(0);
    }
  } catch {}
}
writeFileSync(PID, String(process.pid));
if (!TOKEN) {
  log("AGENT_TOKEN missing in private/.env.local — exiting");
  process.exit(1);
}

const api = async (method, query = "", body = null) => {
  const r = await fetch(`${SITE}/api/agent${query}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
};

// ── Claude Code (subscription) ──
// The child gets an allow-list, not a copy of our environment: an inherited ANTHROPIC_API_KEY would silently make it paid.
function childEnv() {
  const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|LANG|LC_ALL|HTTP_PROXY|HTTPS_PROXY|NO_PROXY|CLAUDE_CONFIG_DIR|CLAUDE_CODE_OAUTH_TOKEN)$/i;
  const e = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => allowed.test(k) && v !== undefined));
  e.CLAUDE_CODE_GIT_BASH_PATH = process.env.CLAUDE_CODE_GIT_BASH_PATH || GIT_BASH;
  if (env.CLAUDE_CODE_OAUTH_TOKEN) e.CLAUDE_CODE_OAUTH_TOKEN = env.CLAUDE_CODE_OAUTH_TOKEN;
  return e;
}

// The bridge is shared with the owner's other project: one CHEK job at a time, and when it says "busy" we wait
// our turn instead of retrying hard. Its own queue rules are never bypassed.
async function viaBridge(job) {
  const until = Date.now() + 20 * 60e3;
  for (;;) {
    const r = await fetch(`${BRIDGE_URL}/complete`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CLAUDE_BRIDGE_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ system: job.system, messages: [{ role: "user", content: job.prompt }], task: "chek", model: job.model || "claude-opus-5-5", jsonSchema: {} }),
      signal: AbortSignal.timeout(12 * 60e3),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { text: String(j.text || ""), usage: j.usage || {}, model: j.model || job.model };
    if (r.status === 503 && Date.now() + 60e3 < until) {
      log(`bridge busy — waiting (job ${job.id})`);
      await new Promise((res) => setTimeout(res, 60e3));
      continue;
    }
    throw new Error(r.status === 429 ? "Claude subscription limit reached" : `bridge ${r.status}: ${j.error || "no answer"}`);
  }
}

function runClaude(job) {
  if (MODE === "bridge") return viaBridge(job);
  return new Promise((resolve, reject) => {
    const dir = mkdtempSync(join(os.tmpdir(), "chek-claude-"));
    const args = [
      CLI, "-p", "--output-format", "json", "--model", job.model || "claude-opus-5-5",
      "--system-prompt", job.system,
      "--permission-mode", "default", "--setting-sources", "", "--disable-slash-commands", "--strict-mcp-config", "--no-session-persistence",
      "--tools", "",
    ];
    const child = spawn(process.execPath, args, { cwd: dir, env: childEnv(), windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    try {
      os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); // OBS keeps the CPU
    } catch {}
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), RUN_MS);
    child.stdout.setEncoding("utf8").on("data", (d) => (out += d));
    child.stderr.setEncoding("utf8").on("data", (d) => (err = (err + d).slice(-4000)));
    child.on("error", (e) => reject(e));
    child.on("close", () => {
      clearTimeout(timer);
      setTimeout(() => rmSync(dir, { recursive: true, force: true }), 3000).unref();
      const env = out.split("\n").map((l) => l.trim()).filter(Boolean).reverse().map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((o) => o?.type === "result");
      if (!env) return reject(new Error(/log ?in|auth|401|403/i.test(err) ? "Claude CLI is not logged in" : /limit|429|quota/i.test(err) ? "Claude subscription limit reached" : `no result from Claude CLI: ${err.slice(-300)}`));
      if (env.is_error || env.subtype !== "success") return reject(new Error(/limit/i.test(env.result || "") ? "Claude subscription limit reached" : `Claude error: ${String(env.result || env.subtype).slice(0, 300)}`));
      const u = env.usage || {};
      resolve({ text: String(env.result || ""), usage: { inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), outputTokens: u.output_tokens || 0 }, model: Object.keys(env.modelUsage || {})[0] || job.model });
    });
    child.stdin.end(`${job.prompt}\n\nRESPONSE: output exactly one JSON document matching the schema in the system prompt — no prose, no markdown fence.`, "utf8");
  });
}

// ── launch watcher ──
let launch = { armed: false };
let lastSig = null;
let launching = false;

async function watchLaunch() {
  if (!launch.armed || launching) return;
  try {
    const r = await findCreation(launch.creatorWallet, lastSig);
    if (!r.mint) {
      lastSig = r.newest ?? lastSig;
      return;
    }
    launching = true;
    log(`LAUNCH DETECTED mint ${r.mint} tx ${r.signature}`);
    const result = await api("POST", "", { op: "launch_detected", ca: r.mint });
    log(`production confirmed: x=${JSON.stringify(result.x)} tg=${JSON.stringify(result.tg)}`);
    launch.armed = false;
    // static site: same verified facts → commit, build, deploy
    process.env.VERCEL_TOKEN_FILE ||= env.VERCEL_TOKEN_FILE || "";
    const { writeLaunchFiles, shipFiles, LAUNCH_FILES } = await import("../scripts/lib/publish-ca.mjs");
    const p = JSON.parse(readFileSync(join(ROOT, "config/project.json"), "utf8"));
    const rep = await inspectMint(r.mint, { name: p.name, ticker: p.ticker, website: p.links.website, creatorWallet: launch.creatorWallet });
    if (!rep.ok) throw new Error("local re-verification failed");
    const shipped = await shipFiles(LAUNCH_FILES, writeLaunchFiles(r.mint, rep.facts));
    log(`static site ${shipped.ok ? "deployed" : "FAILED"}: ${shipped.log.slice(-3).join(" | ")}`);
    await api("POST", "", { op: "prod_audit" }).then((a) => log(`production audit: ${a.ok ? "clean" : a.problems.join("; ")}`)).catch(() => {});
  } catch (e) {
    log(`launch watcher: ${e.message}`);
    launching = false;
  }
}

// ── main loop ──
async function tickOnce() {
  // without Claude access the agent still watches the launch, but leaves AI jobs for later
  const { job, launch: l } = await api("GET", `?op=claim&host=${encodeURIComponent(os.hostname())}${MODE ? "" : "&noai=1"}`);
  if (l?.armed && !launch.armed) log(`launch watcher ARMED for creator wallet ${l.creatorWallet}`);
  launch = { ...l, armed: Boolean(l?.armed) && !launching };
  if (!job) return false;
  log(`job ${job.id} ${job.kind} (${job.model})`);
  const t0 = Date.now();
  try {
    const r = await runClaude(job);
    const res = await api("POST", "", { op: "result", id: job.id, text: r.text, usage: r.usage, model: r.model });
    log(`job ${job.id} done in ${Math.round((Date.now() - t0) / 1000)}s → ${JSON.stringify(res).slice(0, 200)}`);
  } catch (e) {
    log(`job ${job.id} failed: ${e.message}`);
    await api("POST", "", { op: "fail", id: job.id, error: e.message }).catch(() => {});
  }
  return true;
}

log(`CHEK agent started (pid ${process.pid}) → ${SITE} · Claude: ${MODE ?? "not configured (AI jobs wait)"}`);
setInterval(watchLaunch, 3000);
for (;;) {
  let busy = false;
  try {
    busy = await tickOnce();
  } catch (e) {
    log(`poll failed: ${e.message}`);
  }
  // 10 s idle: live replies to channel messages should go out within about a minute
  await new Promise((r) => setTimeout(r, busy ? 5000 : 10_000));
}
