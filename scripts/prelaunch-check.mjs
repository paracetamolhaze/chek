// Automated part of the pre-launch checklist. Prints ✓/✗/· for everything a script can verify.
//   node scripts/prelaunch-check.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fill, paths, placeholders, readJson, ROOT, SAMPLE, xLength } from "./lib/content.mjs";

const project = readJson(paths.project);
const schedule = readJson(paths.schedule);
const site = project.links.website;
const rows = [];
const add = (state, item, detail = "") => rows.push({ state, item, detail });
const get = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "manual" });
    return { status: r.status, text: await r.text(), headers: r.headers };
  } catch (e) {
    return { status: 0, text: "", error: e.message };
  }
};

// Website
const home = await get(site);
add(home.status === 200 && site.startsWith("https://") ? "ok" : "fail", "Website on HTTPS", `${site} → ${home.status}`);
for (const p of ["/history", "/transparency", "/kit", "/opengraph-image.png", "/favicon.ico", "/icon.svg", "/apple-icon.png", "/manifest.webmanifest", "/sitemap.xml"]) {
  const r = await get(site + p);
  add(r.status === 200 ? "ok" : "fail", `GET ${p}`, String(r.status));
}
const h = home.text;
const meta = (re) => re.test(h);
add(meta(/property="og:title"/) && meta(/property="og:image"/) && meta(/name="twitter:card" content="summary_large_image"/) ? "ok" : "fail", "OG + Twitter card metadata", "og:title, og:image, twitter:card");
add(meta(/rel="icon"/) ? "ok" : "fail", "Favicon linked");
add(/content-security-policy/i.test([...(home.headers?.keys?.() ?? [])].join(" ")) ? "ok" : "fail", "Security headers (CSP)");
const ca = project.status === "live" ? project.token.ca : null;
if (ca) add(h.includes(ca) ? "ok" : "fail", "Live site shows the official CA", ca);
else add(/Not launched yet/i.test(h) && !/[1-9A-HJ-NP-Za-km-z]{43,44}pump/.test(h) ? "ok" : "fail", "Pre-launch: NOT LAUNCHED YET, no address-like string", "");
add(/never DM first/i.test(h) ? "ok" : "fail", "Scam warning on the site");
add(/Always verify the Contract Address/i.test(h) ? "ok" : "fail", "CA warning in How to buy");

// Socials
add(project.links.x ? "ok" : "todo", "X account linked", project.links.x ?? "create @chekcoin");
if (project.links.telegram) {
  const tg = await get(project.links.telegram);
  add(/tgme_page_title/.test(tg.text) ? "ok" : "fail", "Telegram channel exists", project.links.telegram);
} else add("todo", "Telegram channel linked", "create t.me/chekcoin");
add(project.links.telegramChat ? "ok" : "todo", "Telegram chat linked", project.links.telegramChat ?? "create t.me/chekchat");
add(project.links.github ? "ok" : "todo", "Public GitHub repo linked", project.links.github ?? "owner decides the account");

// Token assets (PNG header: width/height at bytes 16..24)
const dims = (f) => {
  const b = readFileSync(join(ROOT, f));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const [tw, th] = dims("brand/social/token-1000.png");
add(tw >= 1000 && tw === th ? "ok" : "fail", "Token image ≥1000×1000, 1:1", `${tw}×${th}`);
const [bw, bh] = dims("brand/social/x-header-1500x500.png");
add(bw === 1500 && bh === 500 ? "ok" : "fail", "Banner 1500×500", `${bw}×${bh}`);
add(/^[A-Z]{1,6}$/.test(project.ticker) ? "ok" : "fail", "Ticker is a clickable cashtag (≤6 letters)", `$${project.ticker}`);
add(project.name.length < 32 ? "ok" : "fail", "Name fits pump.fun (<32)", project.name);

// Content
const x = readJson(paths.x).posts;
const tg = readJson(paths.tg).posts;
const values = placeholders(project, schedule);
const sample = Object.fromEntries(Object.entries({ ...SAMPLE, ...values }).map(([k, v]) => [k, v ?? SAMPLE[k]]));
const long = x.filter((p) => [p.text, ...(p.thread || [])].some((t) => xLength(fill(t, sample).text) > 280));
add(long.length ? "fail" : "ok", "X posts ≤ 280 chars", long.map((p) => p.id).join(", ") || `${x.length} posts`);
add(x.length >= 20 ? "ok" : "fail", "≥ 20 X posts ready", String(x.length));
add(tg.length >= 8 ? "ok" : "fail", "Telegram posts ready", String(tg.length));
add(x.some((p) => p.id === "x-018") && tg.some((p) => p.id === "tg-007") ? "ok" : "fail", "Launch post + Telegram CA pin prepared");
add(schedule.launchAt ? "ok" : "todo", "Launch time confirmed", schedule.launchAt ?? `proposed ${schedule.proposedLaunchAt}`);

// Repo hygiene
const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
const badNames = tracked.filter((f) => /(^|\/)\.env|\.pem$|\.key$|keypair.*\.json$|wallet.*\.json$/i.test(f));
add(badNames.length ? "fail" : "ok", "No secret files tracked by git", badNames.join(", "));
const SECRET = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|VERCEL_TOKEN\s*=\s*[A-Za-z0-9]{20,}|BOT_TOKEN\s*=\s*\d|\b\d{8,10}:[A-Za-z0-9_-]{35}\b|\[(\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\])/;
const leaks = tracked.filter((f) => /\.(m?js|ts|tsx|json|md|html|txt|css)$/.test(f) && SECRET.test(readFileSync(join(ROOT, f), "utf8")));
add(leaks.length ? "fail" : "ok", "No key-like content in tracked files", leaks.join(", "));
const gi = readFileSync(join(ROOT, ".gitignore"), "utf8");
add(/^\.env\*$/m.test(gi) ? "ok" : "fail", ".env* is git-ignored");
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();
add(dirty ? "todo" : "ok", "Everything committed (backup = git)", dirty ? `${dirty.split("\n").length} uncommitted` : "");

const icon = { ok: "✓", fail: "✗", todo: "·" };
for (const r of rows) console.log(`${icon[r.state]} ${r.item}${r.detail ? `  — ${r.detail}` : ""}`);
const fails = rows.filter((r) => r.state === "fail").length;
const todos = rows.filter((r) => r.state === "todo").length;
console.log(`\n${rows.length - fails - todos} ok · ${todos} waiting on owner · ${fails} failed`);
process.exit(fails ? 1 : 0);
