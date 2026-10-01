// Shared helpers for post queues: schedule slots → times, placeholder filling, X length.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const paths = {
  project: join(ROOT, "config/project.json"),
  schedule: join(ROOT, "content/schedule.json"),
  history: join(ROOT, "content/history.json"),
  x: join(ROOT, "content/x/queue.json"),
  tg: join(ROOT, "content/telegram/queue.json"),
};

export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const writeJson = (p, data) => writeFileSync(p, JSON.stringify(data, null, 2) + "\n");

const UNIT = { m: 60e3, h: 3600e3, d: 86400e3 };

// "D3 14:00" → d1 + 2 days at 14:00 UTC.  "T+10m" / "T-3h" / "T+0" → launchAt ± offset (null without launchAt).
export function slotTime(slot, schedule) {
  let m = /^D(\d+) (\d{2}):(\d{2})$/.exec(slot);
  if (m) {
    const d = new Date(`${schedule.d1}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Number(m[1]) - 1);
    d.setUTCHours(Number(m[2]), Number(m[3]));
    return d.toISOString();
  }
  m = /^T([+-])(\d+)?([mhd])?$/.exec(slot);
  if (m) {
    if (!schedule.launchAt) return null;
    const off = m[2] ? Number(m[2]) * UNIT[m[3] || "m"] : 0;
    return new Date(new Date(schedule.launchAt).getTime() + (m[1] === "-" ? -off : off)).toISOString();
  }
  throw new Error(`bad slot: ${slot}`);
}

export function fmtUtc(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

const host = (u) => (u ? u.replace(/^https?:\/\//, "").replace(/\/$/, "") : null);

export function placeholders(project, schedule, extra = {}) {
  const t = project.token;
  const ca = project.status === "live" ? t.ca : null;
  return {
    SITE: host(project.links.website),
    SITE_URL: project.links.website,
    X: host(project.links.x),
    X_URL: project.links.x,
    TG: host(project.links.telegram),
    TG_URL: project.links.telegram,
    TG_CHAT_URL: project.links.telegramChat,
    CA: ca,
    CA_SHORT: ca ? `${ca.slice(0, 4)}…${ca.slice(-4)}` : null,
    LAUNCH_UTC: schedule.launchAt ? fmtUtc(schedule.launchAt) : null,
    CREATED_AT: t.createdAt ? fmtUtc(t.createdAt) : null,
    SUPPLY: t.totalSupply,
    MINT_AUTH: t.mintAuthority,
    FREEZE_AUTH: t.freezeAuthority,
    CREATOR: t.creatorWallet,
    CREATOR_BUY: t.creatorBuy,
    ...extra,
  };
}

// Returns { text, missing[] }. Unknown/empty placeholders stay visible as {{NAME}} and are reported.
export function fill(text, values) {
  const missing = new Set();
  const out = text.replace(/\{\{([A-Z_]+)\}\}/g, (all, k) => {
    const v = values[k];
    if (v === null || v === undefined || v === "") {
      missing.add(k);
      return all;
    }
    return String(v);
  });
  return { text: out, missing: [...missing] };
}

// X counts every URL as 23 characters; this is close enough to warn before posting.
export function xLength(text) {
  return [...text.replace(/https?:\/\/\S+|(?:[a-z0-9-]+\.)+(?:app|fun|io|xyz|com|me|so|ag)(?:\/\S*)?/gi, "x".repeat(23))].length;
}
