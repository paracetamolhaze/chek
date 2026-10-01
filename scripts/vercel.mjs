// Tiny Vercel REST client shared by setup/deploy scripts.
// Token: VERCEL_TOKEN, or a file from VERCEL_TOKEN_FILE containing a line "VERCEL_TOKEN=…" / "vercel token=…".
// The token is read at runtime and never written into this repository.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Team comes from the env or the local, git-ignored .vercel/project.json — never hard-coded in the repo.
const LINK = fileURLToPath(new URL("../.vercel/project.json", import.meta.url));
export const TEAM = process.env.VERCEL_TEAM || (existsSync(LINK) ? JSON.parse(readFileSync(LINK, "utf8")).orgId : undefined);

export function token() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN.trim();
  const file = process.env.VERCEL_TOKEN_FILE;
  if (file && existsSync(file)) {
    const m = readFileSync(file, "utf8").match(/^(?:vercel token|VERCEL_TOKEN)\s*=\s*(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error("no token: set VERCEL_TOKEN or VERCEL_TOKEN_FILE");
}

export async function vercel(path, init = {}) {
  if (!TEAM) throw new Error("no team: set VERCEL_TEAM or link the project (.vercel/project.json)");
  const res = await fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}
