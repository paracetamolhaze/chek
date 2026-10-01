// Owner launch dashboard. Local only: listens on 127.0.0.1, rejects foreign Host/Origin headers.
//   npm run dashboard            → http://127.0.0.1:4747
// Optional env: VERCEL_TOKEN_FILE (deploy after CA/link updates), SOLANA_RPC, DASHBOARD_PORT.
// It never sees a seed phrase or private key: the token is created by the owner on pump.fun; this only reads the chain.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fill, fmtUtc, paths, placeholders, readJson, ROOT, slotTime, writeJson, xLength } from "../scripts/lib/content.mjs";
import { syncReadme } from "../scripts/lib/readme.mjs";
import { inspectMint, isPubkey } from "./solana.mjs";
import { LAUNCH_FILES, writeLaunchFiles } from "../scripts/lib/publish-ca.mjs";
import { calculator, walletBalanceSol } from "./pumpcalc.mjs";

const PORT = Number(process.env.DASHBOARD_PORT || 4747);
const ORIGINS = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ASSET_DIRS = ["content", "brand/social", "website/public/kit"];
const TYPES = { ".png": "image/png", ".gif": "image/gif", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };

// ───────── state ─────────
async function siteStatus(project) {
  const url = project.links.website;
  if (!url) return { ok: false, detail: "no website in config" };
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "cache-control": "no-cache" } });
    const html = await r.text();
    const ca = project.status === "live" ? project.token.ca : null;
    const showsCa = ca ? html.includes(ca) : /Not launched yet/i.test(html);
    return { ok: r.ok && showsCa, code: r.status, detail: r.ok ? (showsCa ? (ca ? "live site shows the CA" : "live site shows NOT LAUNCHED YET") : ca ? "live site does NOT show the CA yet — redeploy" : "unexpected content") : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: `unreachable: ${e.message}` };
  }
}

async function telegramStatus(url) {
  if (!url) return { ok: false, detail: "no link in config" };
  try {
    const html = await (await fetch(url, { signal: AbortSignal.timeout(8000) })).text();
    const title = /tgme_page_title[^>]*>\s*<span[^>]*>([^<]+)/.exec(html)?.[1];
    return title ? { ok: true, detail: `exists: “${title.trim()}”` } : { ok: false, detail: "t.me shows no channel with this name" };
  } catch (e) {
    return { ok: false, detail: `unreachable: ${e.message}` };
  }
}

function queues(project, schedule, extra) {
  const values = placeholders(project, schedule, extra);
  const now = Date.now();
  const load = (file, kind) =>
    readJson(file).posts.map((p) => {
      const parts = [p.text, ...(p.thread || [])].map((t) => fill(t, values));
      const missing = [...new Set(parts.flatMap((x) => x.missing))];
      const at = slotTime(p.slot, schedule);
      return {
        kind,
        id: p.id,
        slot: p.slot,
        where: p.where ?? "x",
        category: p.category,
        pin: p.pin ?? null,
        status: p.status,
        postedUrl: p.postedUrl ?? null,
        publishAfter: at,
        due: Boolean(at && new Date(at).getTime() <= now && p.status === "ready"),
        asset: p.asset ?? null,
        checks: (p.checks || []).map((c) => fill(c, values).text),
        parts: parts.map((x) => x.text),
        chars: kind === "x" ? parts.map((x) => xLength(x.text)) : null,
        missing,
      };
    });
  return [...load(paths.x, "x"), ...load(paths.tg, "telegram")].sort((a, b) => (a.publishAfter ?? "9").localeCompare(b.publishAfter ?? "9"));
}

async function state(extra = {}) {
  const project = readJson(paths.project);
  const schedule = readJson(paths.schedule);
  const xq = readJson(paths.x);
  const [site, tg] = await Promise.all([siteStatus(project), telegramStatus(project.links.telegram)]);
  const posts = queues(project, schedule, extra);
  const launchAt = schedule.launchAt ? new Date(schedule.launchAt).getTime() : null;
  const launch = project.status === "live" ? "LIVE" : launchAt ? (launchAt > Date.now() ? "SCHEDULED" : "DUE — create the token") : "NOT STARTED";
  const checksFile = join(ROOT, "content/checks.json");
  const checks = existsSync(checksFile) ? readJson(checksFile) : null;
  return {
    project,
    schedule: { ...schedule, launchUtc: schedule.launchAt ? fmtUtc(schedule.launchAt) : null },
    profile: xq.profile,
    status: {
      website: site,
      x: project.links.x ? { ok: true, detail: project.links.x } : { ok: false, detail: "add the X link" },
      telegram: tg,
      content: { ok: posts.every((p) => p.status !== "draft"), ready: posts.filter((p) => p.status === "ready" || p.status === "posted").length, total: posts.length, posted: posts.filter((p) => p.status === "posted").length },
      token: project.status === "live" ? { ok: true, detail: "DEPLOYED" } : { ok: false, detail: "NOT DEPLOYED" },
      launch,
    },
    posts,
    history: readJson(paths.history).entries.slice(-8).reverse(),
    checks: checks && { checkedAt: checks.checkedAt, ok: checks.ok, owner: checks.owner, failed: checks.failed, total: checks.total, mint: checks.mint },
    pumpfun: readJson(join(ROOT, "content/pumpfun.json")),
  };
}

// ───────── jobs (commit → build → deploy) ─────────
const jobs = new Map();
function run(cmd, args, log, env = {}, cwd = ROOT) {
  return new Promise((resolve) => {
    log.push(`$ ${cmd === process.execPath ? "node" : cmd} ${args.join(" ").split("\n")[0]}`);
    // no shell: arguments (commit messages with spaces/newlines) are passed through untouched
    const p = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, ...env } });
    const on = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => log.push(l.slice(0, 300)));
    p.stdout.on("data", on);
    p.stderr.on("data", on);
    p.on("close", (code) => resolve(code));
  });
}

function startJob(title, message, files) {
  const id = Math.random().toString(36).slice(2, 10);
  const job = { id, title, log: [], done: false, ok: false };
  jobs.set(id, job);
  (async () => {
    const log = job.log;
    await run("git", ["add", ...files], log);
    const c = await run("git", ["commit", "-m", message], log);
    if (c !== 0) log.push("(nothing new to commit)");
    const hasRemote = (await run("git", ["remote", "get-url", "origin"], [])) === 0;
    if (hasRemote) await run("git", ["push"], log);
    else log.push("no git remote yet — commit stays local");
    // build without npm (npm.cmd can't be spawned without a shell on Windows)
    if ((await run(process.execPath, ["website/scripts/gen-mascots.mjs"], log)) !== 0) return Object.assign(job, { done: true, ok: false });
    if ((await run(process.execPath, ["node_modules/next/dist/bin/next", "build"], log, {}, join(ROOT, "website"))) !== 0) return Object.assign(job, { done: true, ok: false });
    if (!process.env.VERCEL_TOKEN_FILE && !process.env.VERCEL_TOKEN) {
      log.push("VERCEL_TOKEN_FILE not set — run the deploy yourself: npm run deploy");
      return Object.assign(job, { done: true, ok: true });
    }
    const d = await run(process.execPath, ["scripts/deploy.mjs"], log);
    const site = await siteStatus(readJson(paths.project));
    log.push(`live check: ${site.detail}`);
    Object.assign(job, { done: true, ok: d === 0 && site.ok });
  })().catch((e) => {
    job.log.push(String(e));
    Object.assign(job, { done: true, ok: false });
  });
  return id;
}

// ───────── actions ─────────
const ALLOWED_LINK = {
  x: /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}$/,
  telegram: /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/,
  telegramChat: /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/,
  github: /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/,
};

async function applyCa({ ca }) {
  const project = readJson(paths.project);
  // the creator wallet announced (privately) in production is the anchor: a look-alike coin from another wallet is refused
  const prod = await prodApi("GET");
  const creatorWallet = prod?.creatorWallet?.address ?? null;
  const report = await inspectMint(ca, { name: project.name, ticker: project.ticker, website: project.links.website, creatorWallet });
  if (!report.ok) return { error: "verification failed — nothing was changed", report };
  // production first (API, X, Telegram switch in seconds), then the static site
  const launched = await prodApi("POST", { op: "launch", ca });
  const usd = report.facts.creatorBuySol ? await calculator([1]).then((c) => `$${Math.round(Number(report.facts.creatorBuySol) * c.solUsd.usd)} at $${c.solUsd.usd.toFixed(2)}/SOL`).catch(() => null) : null;
  const message = writeLaunchFiles(ca, report.facts, { creatorBuyUsd: usd });
  const job = startJob("Publish CA", message, LAUNCH_FILES);
  return { ok: true, report, launched, job };
}

function applyLinks(body) {
  const project = readJson(paths.project);
  const changed = [];
  for (const [k, re] of Object.entries(ALLOWED_LINK)) {
    const v = (body[k] ?? "").trim();
    if (!v) continue;
    if (!re.test(v)) return { error: `${k}: “${v}” doesn't look like an official link (expected ${re.source})` };
    if (project.links[k] !== v) {
      project.links[k] = v;
      changed.push(k);
    }
  }
  if (!changed.length) return { error: "nothing changed" };
  writeJson(paths.project, project);
  const job = startJob("Update links", `links: add ${changed.join(", ")}`, ["config/project.json"]);
  return { ok: true, changed, job };
}

function setPostStatus({ kind, id, status, url }) {
  const file = kind === "x" ? paths.x : paths.tg;
  const q = readJson(file);
  const p = q.posts.find((x) => x.id === id);
  if (!p) return { error: "no such post" };
  if (!["ready", "posted", "skipped"].includes(status)) return { error: "bad status" };
  if (url && !/^https:\/\/(x\.com|twitter\.com|t\.me)\//.test(url)) return { error: "post URL must be an x.com or t.me link" };
  p.status = status;
  if (status === "posted") {
    p.postedAt = new Date().toISOString();
    if (url) p.postedUrl = url;
  } else {
    delete p.postedAt;
    delete p.postedUrl;
  }
  writeJson(file, q);
  return { ok: true };
}

function setSchedule({ d1, launchAt }) {
  const s = readJson(paths.schedule);
  if (d1) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d1)) return { error: "d1 must be YYYY-MM-DD" };
    s.d1 = d1;
  }
  if (launchAt !== undefined) {
    if (launchAt && Number.isNaN(Date.parse(launchAt))) return { error: "bad launch time" };
    s.launchAt = launchAt ? new Date(launchAt).toISOString() : null;
  }
  writeJson(paths.schedule, s);
  for (const file of [paths.x, paths.tg]) {
    const q = readJson(file);
    for (const p of q.posts) p.publishAfter = slotTime(p.slot, s);
    writeJson(file, q);
  }
  return { ok: true };
}

// ───────── production backend (command center) ─────────
function localEnv() {
  const f = join(ROOT, "private", ".env.local");
  if (!existsSync(f)) return {};
  return Object.fromEntries(readFileSync(f, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
}
async function prodApi(method, body) {
  const token = localEnv().ADMIN_TOKEN;
  const site = readJson(paths.project).links.website;
  if (!token) return { error: "no ADMIN_TOKEN in private/.env.local" };
  try {
    const r = await fetch(`${site}/api/admin`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000) });
    const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    return r.ok ? j : { error: j.error || `HTTP ${r.status}` };
  } catch (e) {
    return { error: e.message };
  }
}

// Pre-mint preview: everything the owner must see before signing.
async function premint({ usd = 200, wallet = null }) {
  const p = readJson(paths.project);
  const pf = readJson(join(ROOT, "content/pumpfun.json"));
  const checks = existsSync(join(ROOT, "content/checks.json")) ? readJson(join(ROOT, "content/checks.json")) : null;
  const calc = await calculator([Number(usd)]);
  const row = calc.rows[0];
  const bal = wallet && isPubkey(wallet) ? await walletBalanceSol(wallet) : null;
  const need = row.sol + row.estFeesSol[1];
  const site = await siteStatus(p);
  return {
    coin: pf.name,
    ticker: `$${pf.ticker}`,
    tickerConfirmed: p.tickerConfirmed,
    supply: calc.params.supply,
    creatorBuyUsd: Number(usd),
    solAmount: row.sol,
    solPrice: calc.solUsd,
    creatorReceives: row.tokens,
    creatorPct: row.pctSupply,
    estFeesSol: row.estFeesSol,
    priceMovePct: row.priceMovePct,
    feeBps: calc.params.feeBps,
    wallet,
    walletBalanceSol: bal,
    walletEnough: bal === null ? null : bal >= need,
    needSol: need,
    website: site.ok ? "READY" : "NOT READY",
    x: p.links.x ? "READY" : "NOT READY",
    telegram: p.links.telegram ? "READY" : "NOT READY",
    mintGate: checks?.mint ?? null,
    checkedAt: calc.checkedAt,
    notes: calc.notes,
  };
}

// ───────── http ─────────
const json = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};
const body = (req) =>
  new Promise((resolve) => {
    let s = "";
    req.on("data", (d) => (s += d).length > 1e5 && req.destroy());
    req.on("end", () => {
      try {
        resolve(JSON.parse(s || "{}"));
      } catch {
        resolve({});
      }
    });
  });

createServer(async (req, res) => {
  try {
    if (!HOSTS.has(req.headers.host)) return json(res, 403, { error: "local only" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && !ORIGINS.has(req.headers.origin)) return json(res, 403, { error: "bad origin" });

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" });
      return res.end(readFileSync(join(ROOT, "dashboard/index.html")));
    }
    if (req.method === "GET" && url.pathname === "/api/state") return json(res, 200, await state({ ROTW_ENTRIES: url.searchParams.get("rotw") || null }));
    if (req.method === "GET" && url.pathname.startsWith("/api/job/")) return json(res, 200, jobs.get(url.pathname.split("/").pop()) ?? { error: "no job" });
    if (req.method === "GET" && url.pathname === "/api/prod") return json(res, 200, await prodApi("GET"));
    if (req.method === "GET" && url.pathname === "/api/calc") return json(res, 200, await calculator());
    // FINAL PUMP.FUN FORM card (generated on demand from config + live calculator)
    if (req.method === "GET" && url.pathname === "/card") {
      const usd = Number(url.searchParams.get("usd") || 200);
      const log = [];
      await run(process.execPath, ["scripts/pumpfun-card.mjs", "--usd", String(Number.isFinite(usd) ? usd : 200)], log);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'self'; img-src 'self' https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'" });
      return res.end(readFileSync(join(ROOT, "private", "pumpfun-card.html")));
    }
    if (req.method === "GET" && url.pathname === "/api/premint") return json(res, 200, await premint({ usd: url.searchParams.get("usd") || 200, wallet: url.searchParams.get("wallet") }));
    if (req.method === "GET" && url.pathname.startsWith("/asset/")) {
      const rel = normalize(decodeURIComponent(url.pathname.slice(7))).replace(/^([/\\])+/, "");
      const full = join(ROOT, rel);
      const okDir = ASSET_DIRS.some((d) => full.startsWith(join(ROOT, d) + sep));
      if (!okDir || !existsSync(full) || !TYPES[extname(full)]) return json(res, 404, { error: "not found" });
      res.writeHead(200, { "content-type": TYPES[extname(full)] });
      return res.end(readFileSync(full));
    }
    if (req.method === "POST") {
      const b = await body(req);
      if (url.pathname === "/api/verify-ca") {
        if (!isPubkey((b.ca || "").trim())) return json(res, 200, { ok: false, checks: [{ ok: false, label: "Valid Solana address", detail: "not a valid public key" }] });
        const p = readJson(paths.project);
        return json(res, 200, await inspectMint(b.ca.trim(), { name: p.name, ticker: p.ticker, website: p.links.website }));
      }
      if (url.pathname === "/api/apply-ca") return json(res, 200, await applyCa({ ca: (b.ca || "").trim() }));
      if (url.pathname === "/api/links") return json(res, 200, applyLinks(b));
      if (url.pathname === "/api/post-status") return json(res, 200, setPostStatus(b));
      if (url.pathname === "/api/schedule") return json(res, 200, setSchedule(b));
      if (url.pathname === "/api/prod") {
        const allowed = ["settings", "schedule", "decide", "sync", "input", "resolve_alert", "run", "telegram_setup", "x_connect_link", "creator_wallet", "arm_launch", "dry_report", "prod_audit", "run_job", "launch"];
        if (!allowed.includes(b.op)) return json(res, 400, { error: "op not allowed" });
        return json(res, 200, await prodApi("POST", b));
      }
      if (url.pathname === "/api/check") {
        const id = Math.random().toString(36).slice(2, 10);
        const job = { id, title: "Pre-launch check", log: [], done: false, ok: false };
        jobs.set(id, job);
        run(process.execPath, ["scripts/prelaunch-check.mjs"], job.log).then((code) => Object.assign(job, { done: true, ok: code === 0 }));
        return json(res, 200, { ok: true, job: id });
      }
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`launch dashboard → http://127.0.0.1:${PORT}  (local only)`));
