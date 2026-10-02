// X drop round draws. Every round closes 24 h after its own post; the seed is the blockhash of the first Solana block
// whose block time is at or after the close; each entered address scores sha256(blockhash + ":" + address) and the
// lowest scores win. Inputs (addresses, slot, blockhash) are published, so anyone can re-run it and get the same result.
import { createHash } from "node:crypto";
import { rpc } from "../../shared/solana-inspect.mjs";
import { audit } from "./core.js";
import { db } from "./db.js";
import { project } from "./project.js";
import { enqueue } from "./queue.js";

export const ROUND_HOURS = 24;
export const roundOf = (text) => Number(/\bROUND\s+(\d{1,3})\b/i.exec(text ?? "")?.[1]) || null;

export const score = (blockhash, wallet) => createHash("sha256").update(`${blockhash}:${wallet}`).digest("hex");
export function pickWinners(blockhash, wallets, k) {
  return [...new Set(wallets)]
    .map((w) => ({ wallet: w, score: score(blockhash, w) }))
    .sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0))
    .slice(0, k);
}

// The first finalized block with blockTime ≥ t (unix seconds). Skipped slots are handled with getBlocks.
export async function firstBlockAtOrAfter(t) {
  const tip = await rpc("getSlot", [{ commitment: "finalized" }]);
  const tipTime = await rpc("getBlockTime", [tip]);
  if (tipTime < t) return null; // the closing moment isn't finalized yet
  const est = tip - Math.floor((tipTime - t) / 0.4);
  // produced blocks around the estimate, widened until they straddle t
  for (let span = 3000; span <= 400_000; span *= 4) {
    const blocks = await rpc("getBlocks", [Math.max(0, est - span), Math.min(tip, est + span), { commitment: "finalized" }]);
    if (!blocks.length) continue;
    const time = (i) => rpc("getBlockTime", [blocks[i]]);
    if ((await time(0)) >= t || (await time(blocks.length - 1)) < t) continue;
    let lo = 0; // time(blocks[lo]) < t
    let hi = blocks.length - 1; // time(blocks[hi]) ≥ t
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((await time(mid)) >= t) hi = mid;
      else lo = mid;
    }
    const slot = blocks[hi];
    const block = await rpc("getBlock", [slot, { commitment: "finalized", transactionDetails: "none", rewards: false, maxSupportedTransactionVersion: 0 }]);
    return { slot, blockhash: block.blockhash, blockTime: block.blockTime };
  }
  throw new Error(`no finalized block found around ${new Date(t * 1000).toISOString()}`);
}

// Published round posts → { round, id, tweetId, postedAt, closesAt } (latest post wins if a round was re-posted)
export async function roundPosts() {
  const sql = await db();
  const rows = await sql`select id, external_id, published_at, payload->'parts'->>0 as text from chek.queue
    where platform = 'x' and id like 'xg-%' and status = 'published' order by published_at`;
  const byRound = new Map();
  for (const r of rows) {
    const round = roundOf(r.text);
    if (round) byRound.set(round, { round, id: r.id, tweetId: r.external_id, postedAt: r.published_at, closesAt: new Date(r.published_at.getTime() + ROUND_HOURS * 3600e3) });
  }
  return byRound;
}

// Seed + entries + winners of one round as of `closesAt` (null while that block isn't finalized).
async function computeRound(round, closesAt, k) {
  const seed = await firstBlockAtOrAfter(Math.ceil(closesAt.getTime() / 1000));
  if (!seed) return null;
  const sql = await db();
  const entries = await sql`select x_handle, wallet, reply_id from chek.x_drop_entries
    where round = ${round} and created_at <= ${closesAt} and replied_at <= ${closesAt} order by wallet`;
  const wallets = entries.map((e) => e.wallet);
  const winners = pickWinners(seed.blockhash, wallets, k).map((w) => {
    const e = entries.find((x) => x.wallet === w.wallet);
    return { handle: e.x_handle, wallet: w.wallet, reply_id: e.reply_id, score: w.score };
  });
  return { seed, wallets, winners };
}

// Operator check: what a round would give if it closed at `at` (default: a minute ago). Saves and posts nothing.
export async function drawPreview(round, at) {
  const closesAt = at ? new Date(at) : new Date(Date.now() - 60e3);
  return { round, closesAt, ...(await computeRound(round, closesAt, project().drop?.x?.rounds?.winners ?? 5)) };
}

// Job: draw every round that has closed and isn't drawn yet; queue the winners posts.
export async function runRoundDraws(now = new Date()) {
  const sql = await db();
  const p = project();
  const k = p.drop?.x?.rounds?.winners ?? 5;
  const done = [];
  for (const r of (await roundPosts()).values()) {
    if (r.closesAt > now) continue;
    const [have] = await sql`select round from chek.drop_rounds where round = ${r.round}`;
    if (have) continue;
    const c = await computeRound(r.round, r.closesAt, k);
    if (!c) continue; // the closing block isn't finalized yet — next tick
    const { seed, wallets, winners } = c;
    await sql`insert into chek.drop_rounds (round, post_id, tweet_id, posted_at, closes_at, slot, blockhash, block_time, entries, wallets, winners)
      values (${r.round}, ${r.id}, ${r.tweetId}, ${r.postedAt}, ${r.closesAt}, ${seed.slot}, ${seed.blockhash}, ${new Date(seed.blockTime * 1000)},
        ${wallets.length}, ${sql.json(wallets)}, ${sql.json(winners)}) on conflict (round) do nothing`;
    await audit("draw", "drop.round_drawn", "ok", { ref: `round-${r.round}`, detail: { entries: wallets.length, slot: seed.slot, winners: winners.map((w) => w.handle) } });
    await queueWinnersPosts(r, seed, winners, wallets.length);
    done.push(r.round);
  }
  return { drawn: done };
}

async function queueWinnersPosts(r, seed, winners, n) {
  const p = project();
  const each = p.drop.x.rounds.each.toLocaleString("en-US");
  const tag = `$${p.ticker}`;
  const xText = winners.length
    ? `🧾 GIVEAWAY ROUND ${r.round} — WINNERS\n\n${winners.map((w) => `@${w.handle}`).join("\n")}\n\n${each} ${tag} each, sent after launch. ${n} entries · seed: solana block ${seed.slot}\nre-check it: {{SITE}}/drop`
    : `🧾 GIVEAWAY ROUND ${r.round} closed with no entries locked in at {{SITE}}/drop. new rounds keep coming.`;
  const tgText = winners.length
    ? `🧾 X giveaway round ${r.round} — winners\n\n${winners.map((w) => `x.com/${w.handle} · ${w.wallet.slice(0, 4)}…${w.wallet.slice(-4)}`).join("\n")}\n\n${each} ${tag} each, sent after launch. ${n} entries. Seed: Solana block ${seed.slot}. Anyone can re-check: {{SITE_URL}}/drop`
    : null;
  const why = `round ${r.round} draw (${n} entries, slot ${seed.slot})`;
  await enqueue({ id: `xw-${r.round}`, platform: "x", category: "community", level: "auto", origin: "draw", payload: { parts: [xText], asset: null, imageUrl: null, allowMentions: winners.map((w) => w.handle), why } });
  if (tgText) await enqueue({ id: `tgw-${r.round}`, platform: "telegram", category: "community", level: "auto", origin: "draw", payload: { parts: [tgText], asset: null, imageUrl: null, where: "channel", why } });
}

// Public results for the site.
export async function roundResults() {
  const sql = await db();
  const drawn = await sql`select round, tweet_id, posted_at, closes_at, slot, blockhash, block_time, entries, wallets, winners from chek.drop_rounds order by round`;
  const open = [...(await roundPosts()).values()].filter((r) => !drawn.some((d) => d.round === r.round));
  const counts = await sql`select round, count(*)::int as n from chek.x_drop_entries where round is not null group by round`;
  const handle = project().accounts?.x?.handle ?? "chekcoinsol";
  const post = (id) => (id ? `https://x.com/${handle}/status/${id}` : null);
  return {
    rule: "seed = blockhash of the first Solana block with block time ≥ the round's close (24 h after its post); score = sha256(blockhash + ':' + address); the lowest scores win",
    drawn: drawn.map((d) => ({
      round: d.round, post: post(d.tweet_id), closesAt: d.closes_at, slot: Number(d.slot), blockhash: d.blockhash, blockTime: d.block_time, entries: d.entries,
      wallets: d.wallets, winners: d.winners.map((w) => ({ handle: w.handle, wallet: w.wallet })),
    })),
    open: open.map((r) => ({ round: r.round, post: post(r.tweetId), closesAt: r.closesAt, entries: counts.find((c) => c.round === r.round)?.n ?? 0 })),
  };
}
