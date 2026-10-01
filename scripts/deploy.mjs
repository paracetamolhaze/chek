// Deploys the site + backend to Vercel via the REST API.
//   VERCEL_TOKEN_FILE=… node scripts/deploy.mjs            → production
//   VERCEL_TOKEN_FILE=… node scripts/deploy.mjs --preview  → preview only
// Layout uploaded (repository layout kept so the same relative paths work everywhere):
//   public/            ← website/out (static pages)   public/media/ ← content images for posts
//   api/, server/, shared/, brand/mascot.mjs, config/project.json, content/*.json, package*.json, vercel.json
// Build the site first: npm run build. Secrets are never uploaded; the deploy refuses anything key-like.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { vercel } from "./vercel.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "website", "out");
const PREVIEW = process.argv.includes("--preview");

if (!existsSync(join(OUT, "index.html"))) throw new Error("website/out is empty — run `npm run build` first");
const link = JSON.parse(readFileSync(join(ROOT, ".vercel", "project.json"), "utf8"));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}
const rel = (f, base = ROOT) => relative(base, f).split(sep).join("/");

const entries = [
  ...walk(OUT).map((f) => [f, `public/${rel(f, OUT)}`]),
  ...["mascot", "memes", "animations"].flatMap((d) => walk(join(ROOT, "content", d)).map((f) => [f, `public/media/${d}/${rel(f, join(ROOT, "content", d))}`])),
  ...walk(join(ROOT, "api")).map((f) => [f, rel(f)]),
  ...walk(join(ROOT, "server", "lib")).map((f) => [f, rel(f)]),
  ...walk(join(ROOT, "server", "fonts")).map((f) => [f, rel(f)]),
  ...walk(join(ROOT, "shared")).map((f) => [f, rel(f)]),
  ...["brand/mascot.mjs", "config/project.json", "content/history.json", "content/schedule.json", "content/pumpfun.json", "content/x/queue.json", "content/telegram/queue.json", "package.json", "package-lock.json", "vercel.json"].map((p) => [join(ROOT, p), p]),
].filter(([f]) => existsSync(f));

const files = entries.map(([full, file]) => {
  const data = readFileSync(full);
  return { file, data, size: data.length, sha: createHash("sha1").update(data).digest("hex") };
});

// Safety net: PEM keys, env-style token values, Telegram bot tokens, Solana keypair arrays.
const SECRET = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|VERCEL_TOKEN\s*=\s*[A-Za-z0-9]{20,}|BOT_TOKEN\s*=\s*\d|\b\d{8,10}:[A-Za-z0-9_-]{35}\b|sk_live_|sk-ant-[A-Za-z0-9_-]{20,}|\[(\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\])/;
for (const f of files) {
  if (/\.(html|m?js|json|txt|css)$/.test(f.file) && SECRET.test(f.data.toString("utf8"))) throw new Error(`refusing to deploy, secret-looking content in ${f.file}`);
}

console.log(`uploading ${files.length} files (${Math.round(files.reduce((s, f) => s + f.size, 0) / 1024)} KB)…`);
for (const f of files) {
  const r = await vercel("/v2/files", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "x-vercel-digest": f.sha, "Content-Length": String(f.size) },
    body: f.data,
  });
  if (r.status >= 300) throw new Error(`upload ${f.file}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
}

const created = await vercel("/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1", {
  method: "POST",
  body: JSON.stringify({
    name: link.projectName,
    project: link.projectId,
    target: PREVIEW ? undefined : "production",
    files: files.map(({ file, sha, size }) => ({ file, sha, size })),
    projectSettings: { framework: null, buildCommand: "", installCommand: "npm ci --omit=dev --no-audit --no-fund", outputDirectory: "public", devCommand: null, nodeVersion: "24.x" },
  }),
});
if (created.body?.error) {
  console.error("error:", created.body.error.code, "|", created.body.error.message);
  process.exit(1);
}
console.log("deployment:", `https://${created.body.url}`);

for (let i = 0; i < 100; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const st = await vercel(`/v13/deployments/${created.body.id}`);
  const state = st.body?.readyState;
  if (["READY", "ERROR", "CANCELED", "BLOCKED"].includes(state)) {
    console.log("state:", state, st.body?.errorMessage || "");
    if (state !== "READY") process.exit(1);
    const aliases = (st.body.alias || []).map((a) => `https://${a}`);
    console.log(PREVIEW ? `preview: https://${created.body.url}` : `production: ${aliases.join(" ") || `https://${created.body.url}`}`);
    process.exit(0);
  }
}
console.error("not ready after ~6 minutes");
process.exit(1);
