// NEWS AGENT: collect → dedupe → cheap relevance score → (AI) evaluate against the fetched article → evidence check → draft.
// Hard rule: every factual claim in a draft must carry a verbatim quote that is found in the fetched source text.
// No quote, no post. Sources are stored with SOURCE / URL / PUBLISHED_AT / CHECKED_AT.
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { audit, bump } from "./core.js";
import { db } from "./db.js";
import { aiReady, structured } from "./llm.js";
import { enqueue } from "./queue.js";
import { VOICE } from "./voice.js";

// Reputable feeds only (verified live 2026-10-01).
// mode "full": primary/official sources — the article page is fetched and claims are checked against it.
// mode "headline": newsrooms whose terms restrict automated collection — we use ONLY the feed's own headline/summary
// and always link + attribute; their article pages are never fetched or reproduced.
export const SOURCES = [
  { name: "Solana Foundation", url: "https://solana.com/news/rss.xml", tier: 1, mode: "full" },
  { name: "Helius", url: "https://www.helius.dev/blog/rss.xml", tier: 1, mode: "full" },
  { name: "CFTC", url: "https://www.cftc.gov/RSS/RSSGP/rssgp.xml", tier: 1, mode: "full" },
  { name: "Know Your Meme", url: "https://knowyourmeme.com/editorials.rss", tier: 1, mode: "full" },
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", tier: 2, mode: "headline" },
  { name: "Decrypt", url: "https://decrypt.co/feed", tier: 2, mode: "headline" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml", tier: 2, mode: "headline" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", tier: 2, mode: "headline" },
  { name: "The Defiant", url: "https://thedefiant.io/api/feed", tier: 2, mode: "headline" },
];

const KEYWORDS = [
  [/\bsolana\b|\bSOL\b/i, 2],
  [/\bmeme ?coins?\b|\bmemecoin/i, 3],
  [/pump\.fun|pumpswap/i, 3],
  [/\bpromis(?:e|ed|es)\b|\bpledge[sd]?\b|\bvow(?:s|ed)?\b|\bclaims?\b/i, 3],
  [/\bproof\b|\breceipts?\b|\btransparen/i, 3],
  [/\brug ?pull|\bexploit|\bhack(?:ed)?\b|\bscam/i, 2],
  [/\bairdrop|\bpresale\b/i, 1],
  [/\bETF\b|\bSEC\b/i, 1],
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });
const text = (v) => (typeof v === "string" ? v : v?.["#text"] ?? "");

export async function fetchFeeds() {
  const sql = await db();
  let added = 0;
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { headers: { "user-agent": "CHEK-news-agent/1.0 (+https://chekcoin.vercel.app)" }, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = parser.parse(await res.text());
      const items = doc.rss?.channel?.item ?? doc.feed?.entry ?? [];
      for (const it of [].concat(items).slice(0, 40)) {
        const title = text(it.title).trim();
        const link = text(it.link?.["@href"] ?? it.link ?? it.guid).trim().replace(/[?&]utm_[^&#]+/g, "").replace(/\?$/, "");
        const summary = text(it.description ?? it.summary ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
        if (!title || !/^https?:\/\//.test(link)) continue;
        const published = it.pubDate || it.published || it.updated || null;
        const score = KEYWORDS.reduce((n, [re, w]) => n + (re.test(title) ? w : 0), 0) + (s.tier === 1 ? 1 : 0);
        const r = await sql`insert into chek.news_items (url, source, title, published_at, score, data)
          values (${link}, ${s.name}, ${title.slice(0, 300)}, ${published ? new Date(published) : null}, ${score}, ${sql.json({ tier: s.tier, mode: s.mode, summary })})
          on conflict (url) do nothing returning id`;
        added += r.length;
      }
      await audit("news", "feed.fetched", "ok", { source: s.name });
    } catch (e) {
      await audit("news", "feed.fetch_failed", "error", { source: s.name, error: e.message });
    }
  }
  await bump("news_fetched", added);
  return added;
}

function articleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
const norm = (s) => s.toLowerCase().replace(/[“”"']/g, "").replace(/\s+/g, " ").trim();

const Verdict = z.object({
  relevant: z.boolean().describe("true only if this genuinely fits CHEK's proof/receipts angle or Solana/meme culture"),
  why: z.string(),
  angle: z.enum(["receipt_question", "receipt_roast", "meme_reaction", "solana_note", "none"]),
  claims: z.array(z.object({ claim: z.string(), quote: z.string().describe("verbatim sentence copied from SOURCE TEXT that supports the claim") })),
  post: z.string().describe("X post ≤ 240 chars in the CHEK voice, ending with the source link placeholder {{SOURCE_URL}}; empty if not relevant"),
  names_real_people: z.boolean(),
  critical_of_someone: z.boolean(),
  about_chek_price: z.boolean(),
});

export async function evaluateNews(limit = 3) {
  if (!aiReady()) return { skipped: "no AI key" };
  const sql = await db();
  const rows = await sql`select * from chek.news_items where status = 'new' and score >= 3 and fetched_at > now() - interval '36 hours'
    order by score desc, published_at desc nulls last limit ${limit}`;
  let drafted = 0;
  for (const n of rows) {
    const checkedAt = new Date().toISOString();
    let body = "";
    if (n.data?.mode === "headline") {
      // newsroom: only the feed's own headline + summary, never the article page
      body = `${n.title}. ${n.data?.summary ?? ""}`.trim();
    } else {
      try {
        const res = await fetch(n.url, { headers: { "user-agent": "CHEK-news-agent/1.0 (+https://chekcoin.vercel.app)" }, signal: AbortSignal.timeout(15_000) });
        body = articleText(await res.text()).slice(0, 18_000);
      } catch (e) {
        await sql`update chek.news_items set status = 'rejected', reason = ${`fetch failed: ${e.message}`}, checked_at = now() where id = ${n.id}`;
        continue;
      }
    }
    if (body.length < (n.data?.mode === "headline" ? 40 : 400)) {
      await sql`update chek.news_items set status = 'rejected', reason = 'source text unavailable', checked_at = now() where id = ${n.id}`;
      continue;
    }
    const v = await structured({
      agent: "news",
      schema: Verdict,
      system: `${VOICE}\n\nYou are the CHEK news desk. Decide whether a news item deserves a post. Most don't. Use ONLY facts in SOURCE TEXT. Every claim needs a verbatim quote from SOURCE TEXT.`,
      prompt: `SOURCE: ${n.source}\nURL: ${n.url}\nPUBLISHED_AT: ${n.published_at ?? "unknown"}\nTITLE: ${n.title}\n\nSOURCE TEXT:\n${body}`,
      effort: "low",
    });
    if (!v) continue;
    const quotesOk = v.claims.length > 0 && v.claims.every((c) => c.quote.length >= 15 && norm(body).includes(norm(c.quote)));
    if (!v.relevant || v.angle === "none" || !v.post) {
      await sql`update chek.news_items set status = 'rejected', reason = ${v.why.slice(0, 300)}, checked_at = now() where id = ${n.id}`;
      continue;
    }
    if (!quotesOk) {
      await sql`update chek.news_items set status = 'rejected', reason = 'evidence quotes not found in source', checked_at = now() where id = ${n.id}`;
      await audit("news", "draft.rejected_no_evidence", "skip", { ref: n.url, source: n.source });
      continue;
    }
    // evidence-checked facts from established sources go out automatically; anything about people or the CHEK price waits for the owner
    const sensitive = v.names_real_people || v.critical_of_someone || v.about_chek_price;
    const source = { source: n.source, url: n.url, publishedAt: n.published_at, checkedAt, claims: v.claims };
    await enqueue({
      id: `news-${n.id}-x`,
      platform: "x",
      category: "news",
      level: sensitive ? "review" : "auto",
      origin: "news",
      source,
      payload: { parts: [v.post.replace("{{SOURCE_URL}}", n.url)] },
      publishAfter: new Date(Date.now() + 20 * 60e3).toISOString(),
    });
    await sql`update chek.news_items set status = ${sensitive ? "review" : "drafted"}, reason = ${v.why.slice(0, 300)}, checked_at = now(), data = data || ${sql.json({ angle: v.angle })} where id = ${n.id}`;
    drafted++;
    await bump("news_drafted");
  }
  await bump("news_reviewed", rows.length);
  return { reviewed: rows.length, drafted };
}
