// Tiny Vercel REST client shared by setup/deploy scripts.
// Token: VERCEL_TOKEN, or a file from VERCEL_TOKEN_FILE containing a line "VERCEL_TOKEN=…" / "vercel token=…".
// The token is read at runtime and never written into this repository.
import { existsSync, readFileSync } from "node:fs";

export const TEAM = process.env.VERCEL_TEAM;

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
