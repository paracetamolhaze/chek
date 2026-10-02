// Project data. The deployment keeps the repository layout (config/, content/ next to server/),
// so the same relative paths work locally and on Vercel. config/project.json is the single source of truth.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function load(repoPath) {
  const f = fileURLToPath(new URL(`../../${repoPath}`, import.meta.url));
  if (!existsSync(f)) throw new Error(`missing ${repoPath}`);
  return JSON.parse(readFileSync(f, "utf8"));
}

export const project = () => load("config/project.json");
export const history = () => load("content/history.json");
export const scheduleSeed = () => load("content/schedule.json");
export const assetLibrary = () => load("content/assets.json").assets;
export const seedQueue = () => ({ x: load("content/x/queue.json"), telegram: load("content/telegram/queue.json") });

export function officialCa(p = project()) {
  return p.status === "live" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.token.ca || "") ? p.token.ca : null;
}

// After the mint is verified, the launch op stores the chain-confirmed token facts in settings.token_live, so every
// surface (API, posts, guards) switches in seconds — before the static site rebuild + redeploy lands.
export function withLiveToken(p, live) {
  if (!live?.ca) return p;
  return { ...p, status: "live", token: { ...p.token, ...live } };
}
