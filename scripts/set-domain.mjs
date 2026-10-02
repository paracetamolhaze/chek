// Switch the canonical website domain everywhere, in ONE commit + ONE deploy, then audit production.
//   VERCEL_TOKEN_FILE=… node scripts/set-domain.mjs https://chekcoinsol.xyz [--dry]
// Refuses: the CHECK spelling, a domain that doesn't answer over HTTPS with this site, a domain not attached to the project.
// Updates: config (links.website, domain), README, X profile url, Telegram setup text, Pump.fun description, rendered
// images that print the host, Vercel SITE_URL, Vercel redirects (every other custom domain → canonical), build log entry.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paths, readJson, ROOT, writeJson } from "./lib/content.mjs";
import { shipFiles } from "./lib/publish-ca.mjs";
import { syncReadme } from "./lib/readme.mjs";
import { vercel } from "./vercel.mjs";
import { execFileSync } from "node:child_process";

const url = (process.argv[2] || "").replace(/\/$/, "");
const DRY = process.argv.includes("--dry");
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();
if (!host || !url.startsWith("https://")) throw new Error("usage: node scripts/set-domain.mjs https://<domain>");
if (/check/i.test(host) || !/chek/i.test(host)) throw new Error(`refused: ${host} — the canonical domain must use the CHEK spelling`);

const project = readJson(paths.project);
const old = project.links.website.replace(/\/$/, "");
const oldHost = new URL(old).hostname;
if (old === url) throw new Error("already canonical");

// 1. the domain must already serve this site
const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) }).catch((e) => ({ ok: false, status: 0, error: e.message }));
const html = res.ok ? await res.text() : "";
if (!res.ok || !/Receipts or it didn/.test(html)) throw new Error(`${url} does not serve the CHEK site yet (${res.status ?? 0}${res.error ? ` ${res.error}` : ""})`);
const link = JSON.parse(readFileSync(join(ROOT, ".vercel", "project.json"), "utf8"));
const domains = (await vercel(`/v9/projects/${link.projectId}/domains`)).body?.domains ?? [];
if (!domains.some((d) => d.name === host)) throw new Error(`${host} is not attached to the Vercel project`);
console.log(`✓ ${url} serves the site and is attached to the project`);
if (DRY) process.exit(0);

// 2. files
project.links.website = url;
project.domain = { canonical: url, previous: old, never: project.domain?.never ?? [], confirmedAt: new Date().toISOString(), note: `Canonical domain confirmed by the owner. Every other domain (incl. ${oldHost} and the CHECK-spelled typo) only redirects here.` };
writeJson(paths.project, project);
syncReadme(project);
const xq = readJson(paths.x);
xq.profile.url = url;
writeJson(paths.x, xq);
const tq = readJson(paths.tg);
tq.setup.channel.description = tq.setup.channel.description.split(oldHost).join(host);
writeJson(paths.tg, tq);
const pf = readJson(join(ROOT, "content/pumpfun.json"));
pf.description = pf.description.split(oldHost).join(host);
writeJson(join(ROOT, "content/pumpfun.json"), pf);
const history = readJson(paths.history);
history.entries.push({ date: new Date().toISOString().replace(/\.\d+Z$/, "Z"), title: `Canonical domain: ${host}`, detail: `The official website moved to ${url}. ${oldHost} keeps working; every other domain only redirects here.`, proof: { label: "config/project.json" } });
writeJson(paths.history, history);
// images that print the host
execFileSync(process.execPath, ["scripts/render-assets.mjs"], { cwd: ROOT, stdio: "inherit" });
execFileSync(process.execPath, ["scripts/render-content.mjs"], { cwd: ROOT, stdio: "inherit" });

// 3. Vercel: SITE_URL + redirects (every other custom domain → canonical, 308)
const envs = (await vercel(`/v9/projects/${link.projectId}/env`)).body?.envs ?? [];
const site = envs.find((e) => e.key === "SITE_URL");
if (site) await vercel(`/v9/projects/${link.projectId}/env/${site.id}`, { method: "DELETE" });
await vercel(`/v10/projects/${link.projectId}/env`, { method: "POST", body: JSON.stringify({ key: "SITE_URL", value: url, type: "plain", target: ["production", "preview"] }) });
await vercel(`/v9/projects/${link.projectId}/domains/${host}`, { method: "PATCH", body: JSON.stringify({ redirect: null }) });
for (const d of domains) {
  // every other custom domain and the project's own vercel.app name redirect to the one official domain
  if (d.name === host || (d.name.endsWith(".vercel.app") && d.name !== oldHost)) continue;
  const r = await vercel(`/v9/projects/${link.projectId}/domains/${d.name}`, { method: "PATCH", body: JSON.stringify({ redirect: host, redirectStatusCode: 308 }) });
  console.log(`redirect ${d.name} → ${host}: ${r.status}`);
}

// 4. one commit, one build, one deploy
const files = ["config/project.json", "README.md", "content/x/queue.json", "content/telegram/queue.json", "content/pumpfun.json", "content/history.json", "website/src/app/opengraph-image.png", "website/src/app/twitter-image.png", "content/mascot", "content/memes", "brand/social", "website/public/kit"];
const out = await shipFiles(files, `domain: canonical website → ${url}\n\nEvery reference switched in one commit; other domains redirect (308).`);
console.log(out.log.slice(-5).join("\n"));
if (!out.ok) process.exit(1);

// 5. fresh production audit on the new canonical domain
execFileSync(process.execPath, ["scripts/prod-audit.mjs", url], { cwd: ROOT, stdio: "inherit" });
