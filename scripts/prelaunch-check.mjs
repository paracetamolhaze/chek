// Pre-launch check. The ONLY source of check counts: writes content/checks.json (timestamped).
//   node scripts/prelaunch-check.mjs           → run + print + save
//   node scripts/prelaunch-check.mjs --no-save → run + print
// States: ok · fail (something is wrong) · owner (waiting on an owner action/decision).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { audit } from "./lib/consistency.mjs";
import { fill, paths, placeholders, readJson, ROOT, SAMPLE, writeJson, xLength } from "./lib/content.mjs";
import { scanRepo } from "./lib/public-scan.mjs";

const project = readJson(paths.project);
const schedule = readJson(paths.schedule);
const pumpfun = readJson(join(ROOT, "content/pumpfun.json"));
const site = project.links.website;
const rows = [];
const add = (group, state, item, detail = "") => rows.push({ group, state, item, detail });
const get = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "manual" });
    return { status: r.status, text: await r.text(), headers: r.headers };
  } catch (e) {
    return { status: 0, text: "", error: e.message };
  }
};

// ── Website (live) ──
const home = await get(site);
add("website", home.status === 200 && site.startsWith("https://") ? "ok" : "fail", "Website on HTTPS", `${site} → ${home.status}`);
for (const p of ["/history", "/transparency", "/kit", "/opengraph-image.png", "/favicon.ico", "/icon.svg", "/apple-icon.png", "/manifest.webmanifest", "/sitemap.xml"]) {
  const r = await get(site + p);
  add("website", r.status === 200 ? "ok" : "fail", `GET ${p}`, String(r.status));
}
const h = home.text;
add("website", /property="og:title"/.test(h) && /property="og:image"/.test(h) && /name="twitter:card" content="summary_large_image"/.test(h) ? "ok" : "fail", "OG + Twitter card metadata");
add("website", /rel="icon"/.test(h) ? "ok" : "fail", "Favicon linked");
add("website", home.headers?.get?.("content-security-policy") ? "ok" : "fail", "Security headers (CSP)");
const ca = project.status === "live" ? project.token.ca : null;
if (ca) add("website", h.includes(ca) ? "ok" : "fail", "Live site shows the official CA", ca);
else add("website", /Not launched yet/i.test(h) && !/[1-9A-HJ-NP-Za-km-z]{43,44}pump/.test(h) ? "ok" : "fail", "Live site: NOT LAUNCHED YET, no address-like string");
add("website", /not affiliated with this project/i.test(h) ? "ok" : "fail", "Live site: look-alike tokens “not affiliated” (not “fake”)");
add("website", /never DM first/i.test(h) && /Always verify the Contract Address/i.test(h) ? "ok" : "fail", "Live site: DM + CA warnings");
add("website", project.site?.analytics ? "ok" : "owner", "Analytics (Vercel Web Analytics)", project.site?.analytics ? "on" : "owner enables it in Vercel");

// ── Backend (production) ──
const ping = await get(`${site}/api/public?op=ping`);
add("backend", ping.status === 200 ? "ok" : "fail", "API functions deployed", `${ping.status}`);
const priv = join(ROOT, "private/.env.local");
const adminToken = existsSync(priv) ? (readFileSync(priv, "utf8").match(/^ADMIN_TOKEN=(.+)$/m)?.[1] ?? "").trim() : "";
let integ = null;
if (adminToken) {
  try {
    const r = await fetch(`${site}/api/admin`, { headers: { authorization: `Bearer ${adminToken}` }, signal: AbortSignal.timeout(20000) });
    if (r.ok) integ = (await r.json()).integrations;
  } catch {}
}
add("backend", integ?.database ? "ok" : "owner", "Database connected", integ ? "" : "owner: dedicated Supabase project (or approve the shared one) → DATABASE_URL");
add("backend", integ?.telegram ? "ok" : "owner", "Telegram bot token", integ?.telegram ? "" : "owner: @BotFather → TELEGRAM_BOT_TOKEN");
add("backend", integ?.x ? "ok" : "owner", "X API app keys", integ?.x ? "" : "owner: X developer app (pay-per-use) → X_CLIENT_ID/SECRET");
add("backend", integ?.ai ? "ok" : "owner", "AI key (authored posts, news verdicts)", integ?.ai ? "" : "owner: ANTHROPIC_API_KEY with a spend limit");

// ── Consistency (built site + docs + drafts vs sources) ──
const { results } = audit();
for (const r of results) add("consistency", r.ok ? "ok" : "fail", r.title, r.problems.slice(0, 3).join(" | "));

// ── Name / ticker ──
add("token data", project.tickerConfirmed ? "ok" : "owner", "Ticker decision confirmed", project.tickerConfirmed ? `$${project.ticker}` : "collision report delivered; owner decides A (keep $CHEK) or B (new ticker)");
add("token data", /^[A-Z]{1,6}$/.test(project.ticker) ? "ok" : "fail", "Ticker is a clickable X cashtag (≤6 letters)", `$${project.ticker}`);
const dims = (f) => {
  const b = readFileSync(join(ROOT, f));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const [tw, th] = dims(pumpfun.image);
add("token data", tw >= 1000 && tw === th ? "ok" : "fail", "Token image ≥1000×1000, 1:1", `${tw}×${th}`);
const [bw, bh] = dims(pumpfun.banner);
add("token data", bw === 1500 && bh === 500 ? "ok" : "fail", "Banner 1500×500", `${bw}×${bh}`);
add("token data", pumpfun.description.length < 2000 ? "ok" : "fail", "Description < 2000 chars", `${pumpfun.description.length}`);

// ── Socials ──
add("socials", project.links.x ? "ok" : "owner", "X account linked", project.links.x ?? "owner creates it");
if (project.links.telegram) {
  const tg = await get(project.links.telegram);
  add("socials", /tgme_page_title/.test(tg.text) ? "ok" : "fail", "Telegram channel exists", project.links.telegram);
} else add("socials", "owner", "Telegram channel linked", "owner creates it");
add("socials", project.links.telegramChat ? "ok" : "owner", "Telegram chat linked", project.links.telegramChat ?? "owner creates it");

// ── Content ──
const x = readJson(paths.x).posts;
const tg = readJson(paths.tg).posts;
const values = placeholders(project, schedule);
const sample = Object.fromEntries(Object.entries({ ...SAMPLE, ...values }).map(([k, v]) => [k, v ?? SAMPLE[k]]));
const long = x.filter((p) => [p.text, ...(p.thread || [])].some((t) => xLength(fill(t, sample).text) > 280));
add("content", long.length ? "fail" : "ok", "X drafts ≤ 280 chars", long.map((p) => p.id).join(", ") || `${x.length} drafts`);
add("content", x.some((p) => p.id === "x-018") && tg.some((p) => p.id === "tg-007") ? "ok" : "fail", "Launch post + Telegram CA pin drafted");
add("content", schedule.launchAt ? "ok" : "owner", "Launch time confirmed", schedule.launchAt ?? `proposed ${schedule.proposedLaunchAt}`);

// ── Repository (public readiness) ──
const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
add("repository", /^\.env\*$/m.test(readFileSync(join(ROOT, ".gitignore"), "utf8")) && /^private\/$/m.test(readFileSync(join(ROOT, ".gitignore"), "utf8")) ? "ok" : "fail", ".env* and private/ are git-ignored");
const findings = scanRepo(ROOT);
const nowF = findings.filter((f) => f.where === "tracked");
const histF = findings.filter((f) => f.where !== "tracked");
add("repository", nowF.length ? "fail" : "ok", "Current files: no secrets / personal data", [...new Set(nowF.map((f) => `${f.file}: ${f.why}`))].join(" | "));
add("repository", histF.length ? "owner" : "ok", "Git history: no secrets / personal data", histF.length ? `${new Set(histF.map((f) => f.commit)).size} old commits need the scrub (scripts/prepare-public-repo.mjs) — owner approves` : "");
add("repository", project.links.github ? "ok" : "owner", "Public GitHub repo", project.links.github ?? "owner picks the account");
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();
add("repository", dirty ? "owner" : "ok", "Everything committed", dirty ? `${dirty.split("\n").length} uncommitted` : "");
void tracked;

// ── Mint gate: Pump.fun details can't be edited after creation ──
const need = (cond, what) => (cond ? null : what);
const gate = [
  need(home.status === 200, "website live"),
  need(project.links.x, "X linked"),
  need(project.links.telegram, "Telegram linked"),
  need(project.tickerConfirmed, "name/ticker confirmed"),
  need(tw >= 1000 && bw === 1500, "token image + banner"),
  need(pumpfun.description.length < 2000, "description"),
  need(schedule.launchAt, "launch time"),
  need(project.links.github && !histF.length, "public repo (the site promises it before launch)"),
  need(results.every((r) => r.ok), "consistency audit"),
].filter(Boolean);
const mint = { ready: gate.length === 0, blockers: gate };

const icon = { ok: "✓", fail: "✗", owner: "·" };
let group = "";
for (const r of rows) {
  if (r.group !== group) console.log(`\n${(group = r.group).toUpperCase()}`);
  console.log(`  ${icon[r.state]} ${r.item}${r.detail ? `  — ${r.detail}` : ""}`);
}
const n = (s) => rows.filter((r) => r.state === s).length;
const summary = { checkedAt: new Date().toISOString(), total: rows.length, ok: n("ok"), owner: n("owner"), failed: n("fail") };
console.log(`\n${summary.ok} ok · ${summary.owner} waiting on the owner · ${summary.failed} failed  (of ${summary.total})`);
console.log(mint.ready ? "READY TO MINT" : `NOT READY TO MINT — ${mint.blockers.join(", ")}`);
if (!process.argv.includes("--no-save")) writeJson(join(ROOT, "content/checks.json"), { $comment: "Generated by npm run check. The only source for check counts.", ...summary, mint, rows });
process.exit(summary.failed ? 1 : 0);
