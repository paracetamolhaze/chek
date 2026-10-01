// Deploys the prebuilt static site (website/out + website/vercel.json) to Vercel via the REST API.
//   VERCEL_TOKEN_FILE=… node scripts/deploy.mjs            → production
//   VERCEL_TOKEN_FILE=… node scripts/deploy.mjs --preview  → preview only
// Build first: npm run build. Only static files are uploaded: no server code, no secrets.
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
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

const files = [
  ...walk(OUT).map((full) => ({ full, file: relative(OUT, full).split(sep).join("/") })),
  { full: join(ROOT, "website", "vercel.json"), file: "vercel.json" },
].map(({ full, file }) => {
  const data = readFileSync(full);
  return { file, data, size: data.length, sha: createHash("sha1").update(data).digest("hex") };
});

// Safety net: never ship anything that looks like a secret.
// (PEM keys, env-style tokens, Telegram bot tokens, Solana keypair JSON arrays of 64 bytes)
const SECRET = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|VERCEL_TOKEN\s*=|BOT_TOKEN\s*=|\b\d{8,10}:[A-Za-z0-9_-]{35}\b|sk_live_|\[(\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\])/;
for (const f of files) {
  if (/\.(html|js|json|txt|css)$/.test(f.file) && SECRET.test(f.data.toString("utf8"))) throw new Error(`refusing to deploy, secret-looking content in ${f.file}`);
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
    projectSettings: { framework: null, buildCommand: "", installCommand: "", outputDirectory: "", devCommand: null },
  }),
});
if (created.body?.error) {
  console.error("error:", created.body.error.code, "|", created.body.error.message);
  process.exit(1);
}
console.log("deployment:", `https://${created.body.url}`);

for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 3000));
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
console.error("not ready after 3 minutes");
process.exit(1);
