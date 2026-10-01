// Owner/operator CLI for the production admin API (token read from private/.env.local, never printed).
//   node scripts/admin.mjs status
//   node scripts/admin.mjs <op> ['{"json":"body"}']      e.g. node scripts/admin.mjs dry_start '{"hours":24}'
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const envFile = join(ROOT, "private", ".env.local");
const env = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {};
const site = (env.CHEK_SITE || JSON.parse(readFileSync(join(ROOT, "config/project.json"), "utf8")).links.website).replace(/\/$/, "");
const [op = "status", body = "{}"] = process.argv.slice(2);
const init = { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, "content-type": "application/json" }, signal: AbortSignal.timeout(290_000) };
const res = op === "status" ? await fetch(`${site}/api/admin`, init) : await fetch(`${site}/api/admin`, { ...init, method: "POST", body: JSON.stringify({ op, ...JSON.parse(body) }) });
const text = await res.text();
let out;
try {
  out = JSON.parse(text);
} catch {
  out = text.slice(0, 2000);
}
console.log(res.status, typeof out === "string" ? out : JSON.stringify(out, null, 2));
process.exitCode = res.ok ? 0 : 1;
