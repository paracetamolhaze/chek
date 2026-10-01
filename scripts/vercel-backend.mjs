// One-time backend setup on Vercel (idempotent):
//   VERCEL_TOKEN_FILE=… node scripts/vercel-backend.mjs env       generate app secrets → Vercel env (sensitive) + private/.env.local
//   VERCEL_TOKEN_FILE=… node scripts/vercel-backend.mjs region    functions in fra1 (next to the database)
//   VERCEL_TOKEN_FILE=… node scripts/vercel-backend.mjs storage   connect the owner's existing Supabase store (temporary, for db_setup)
//   VERCEL_TOKEN_FILE=… node scripts/vercel-backend.mjs names     list env var NAMES (values are never read)
// Owner-provided secrets (TELEGRAM_BOT_TOKEN, X_CLIENT_ID/SECRET, ANTHROPIC_API_KEY) are added by the owner in Vercel — not here.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { vercel } from "./vercel.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const link = JSON.parse(readFileSync(join(ROOT, ".vercel", "project.json"), "utf8"));
const LOCAL = join(ROOT, "private", ".env.local");
const cmd = process.argv[2];

async function envNames() {
  const r = await vercel(`/v9/projects/${link.projectId}/env`);
  return r.body?.envs || [];
}

async function setEnv(key, value, type = "sensitive") {
  const existing = (await envNames()).find((e) => e.key === key);
  if (existing) await vercel(`/v9/projects/${link.projectId}/env/${existing.id}`, { method: "DELETE" });
  const r = await vercel(`/v10/projects/${link.projectId}/env`, { method: "POST", body: JSON.stringify({ key, value, type, target: ["production", "preview"] }) });
  if (r.status >= 300) throw new Error(`${key}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
}

if (cmd === "env") {
  mkdirSync(join(ROOT, "private"), { recursive: true });
  const local = existsSync(LOCAL) ? Object.fromEntries(readFileSync(LOCAL, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {};
  const names = new Set((await envNames()).map((e) => e.key));
  for (const key of ["APP_SECRET", "CRON_SECRET", "ADMIN_TOKEN", "TELEGRAM_WEBHOOK_SECRET"]) {
    if (names.has(key) && local[key]) {
      console.log(key, "already set");
      continue;
    }
    local[key] = randomBytes(32).toString("base64url");
    await setEnv(key, local[key]);
    console.log(key, "set");
  }
  await setEnv("SITE_URL", "https://chekcoin.vercel.app", "plain");
  writeFileSync(LOCAL, Object.entries(local).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  console.log("local copy → private/.env.local (git-ignored)");
} else if (cmd === "region") {
  const r = await vercel(`/v9/projects/${link.projectId}`, { method: "PATCH", body: JSON.stringify({ resourceConfig: { functionDefaultRegions: ["fra1"] }, nodeVersion: "24.x" }) });
  console.log("region fra1:", r.status < 300 ? "ok" : `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
} else if (cmd === "storage") {
  const list = await vercel("/v1/storage/stores");
  const stores = list.body?.stores || [];
  const store = stores.find((s) => (s.projectsMetadata || []).some((p) => p.name === "wheel-points"));
  if (!store) throw new Error("existing Supabase store not found");
  if ((store.projectsMetadata || []).some((p) => p.projectId === link.projectId)) console.log("already connected:", store.name);
  else {
    const r = await vercel(`/v1/storage/stores/${store.id}/connections`, { method: "POST", body: JSON.stringify({ projectId: link.projectId, envVarEnvironments: ["production", "preview"] }) });
    console.log("connect:", r.status < 300 ? "ok" : `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  }
} else if (cmd === "names") {
  for (const e of await envNames()) console.log(e.key.padEnd(28), e.type, e.target?.join(","));
} else {
  console.log("usage: env | region | storage | names");
}
