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

export function placeholders(project, schedule, extra = {}, now = new Date()) {
  const t = project.token;
  const ca = project.status === "live" ? t.ca : null;
  // Day 1 = the day the site went public (UTC). Computed for the moment of posting — never backdated.
  const dayN = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.parse(`${project.publicSince}T00:00:00Z`)) / 86400e3) + 1;
  const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return {
    DAY_N: dayN,
    CREATOR_FEE: project.platform?.creatorFee,
    FEE_CHECKED: project.platform ? fmtDay(project.platform.checkedAt) : null,
    CREATION_TX: t.creationTx,
    CREATION_FEE: t.creationFeeSol,
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

// Realistic stand-ins for values that only exist after launch (used to measure post length in advance).
export const SAMPLE = {
  CA: "X".repeat(44),
  CA_SHORT: "XXXX…XXXX",
  LAUNCH_UTC: "Oct 7, 15:00 UTC",
  TG: "t.me/chekcoin",
  CREATED_AT: "Oct 7, 15:00 UTC",
  SUPPLY: "1,000,000,000",
  MINT_AUTH: "disabled",
  FREEZE_AUTH: "disabled",
  CREATOR: "X".repeat(44),
  CREATOR_BUY: "25,000,000 CHEK (2.50% of supply) in the creation tx",
  ROTW_ENTRIES: "12",
  DAY_N: "9",
  CREATION_TX: "X".repeat(88),
  CREATION_FEE: "0.000105",
};

// X counts every URL as 23 characters; this is close enough to warn before posting.
export function xLength(text) {
  return [...text.replace(/https?:\/\/\S+|(?:[a-z0-9-]+\.)+(?:app|fun|io|xyz|com|me|so|ag)(?:\/\S*)?/gi, "x".repeat(23))].length;
}
