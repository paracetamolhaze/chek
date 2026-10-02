// X drop: one entry = the public link of your reply to @chekcoinsol that contains your Solana address.
// The reply is read through X's public embed endpoint (the one embedded posts on websites use): no X account,
// no API key, nothing is posted or liked. Follow and repost are asked in the posts but cannot be checked this way.
import { createHash } from "node:crypto";
import { isPubkey } from "../../shared/solana-inspect.mjs";
import { bump, getSetting } from "./core.js";
import { db } from "./db.js";
import { env } from "./env.js";
import { project } from "./project.js";

const STATUS = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status(?:es)?\/(\d{5,25})/i;
const ADDR = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const PER_10_MIN = 10;

export const replyIdOf = (link) => String(link ?? "").trim().match(STATUS)?.[1] ?? null;

export async function fetchPost(id) {
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
  const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; chek-drop/1.0; +https://www.chekcoinsol.xyz/drop)" },
    signal: AbortSignal.timeout(8000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`x embed ${r.status}`);
  const t = await r.json().catch(() => null);
  return t?.__typename === "Tweet" ? t : null; // deleted / protected posts come back as tombstones
}

// Salted hash of the caller's IP, kept one day for the rate limit only.
async function tooMany(ip) {
  const key = createHash("sha256").update(`${env.appSecret}:xdrop:${ip || "?"}`).digest("hex").slice(0, 32);
  const sql = await db();
  const [{ n }] = await sql`select count(*)::int as n from chek.rate_hits where key = ${key} and at > now() - interval '10 minutes'`;
  if (n >= PER_10_MIN) return true;
  await sql`insert into chek.rate_hits (key) values (${key})`;
  if (Math.random() < 0.05) await sql`delete from chek.rate_hits where at < now() - interval '1 day'`;
  return false;
}

export async function dropClosed(p = project()) {
  if (p.drop?.status !== "open") return true;
  const launchedAt = (await getSetting("schedule").catch(() => null))?.launchedAt;
  return Boolean(launchedAt && Date.now() > Date.parse(launchedAt) + 24 * 3600e3);
}

// Round number of our drop post, read from its own text ("ROUND 7") — works even if its link was never pasted to the bot.
const roundOf = (text) => Number(/\bROUND\s+(\d{1,3})\b/i.exec(text ?? "")?.[1]) || null;

// → { ok, n, handle, wallet, round } | { error: closed|bad_link|slow_down|not_found|ours|not_reply|too_early|no_address|already|other_wallet|taken }
export async function enterXDrop(link, ip) {
  const p = project();
  const d = p.drop;
  if (!d?.x || (await dropClosed(p))) return { error: "closed" };
  const id = replyIdOf(link);
  if (!id) return { error: "bad_link" };
  if (await tooMany(ip)) return { error: "slow_down" };
  const t = await fetchPost(id);
  if (!t?.user?.id_str) return { error: "not_found" };
  const ours = (p.accounts?.x?.handle ?? "chekcoinsol").toLowerCase();
  const handle = t.user.screen_name;
  if (handle.toLowerCase() === ours) return { error: "ours" };
  if ((t.in_reply_to_screen_name ?? "").toLowerCase() !== ours) return { error: "not_reply" };
  if (d.openedAt && Date.parse(t.created_at) < Date.parse(d.openedAt)) return { error: "too_early" };
  const wallet = (t.text?.match(ADDR) ?? []).find(isPubkey);
  if (!wallet) return { error: "no_address" };
  const parent = t.in_reply_to_status_id_str ?? null;
  const round = roundOf(t.parent?.text);
  const sql = await db();
  // one address per account (the one it entered with first), one account per address, one entry per account per post
  const [mine] = await sql`select wallet from chek.x_drop_entries where x_user_id = ${t.user.id_str} order by id limit 1`;
  if (mine && mine.wallet !== wallet) return { error: "other_wallet", handle, wallet: mine.wallet };
  const [other] = await sql`select 1 from chek.x_drop_entries where wallet = ${wallet} and x_user_id <> ${t.user.id_str} limit 1`;
  if (other) return { error: "taken" };
  const [same] = await sql`select round from chek.x_drop_entries where x_user_id = ${t.user.id_str} and parent_id is not distinct from ${parent}`;
  if (same) return { error: "already", handle, wallet, round: same.round };
  const [row] = await sql`insert into chek.x_drop_entries (x_user_id, x_handle, wallet, reply_id, parent_id, replied_at, round)
    values (${t.user.id_str}, ${handle}, ${wallet}, ${id}, ${parent}, ${t.created_at}, ${round})
    on conflict do nothing returning id`;
  if (!row) return { error: "taken" };
  // n = this account's place among accounts (the airdrop goes to the first accounts in order)
  const [{ n }] = await sql`select count(distinct x_user_id)::int as n from chek.x_drop_entries
    where id <= (select min(id) from chek.x_drop_entries where x_user_id = ${t.user.id_str})`;
  await bump("x_drop_entries");
  return { ok: true, n, handle, wallet, round };
}
