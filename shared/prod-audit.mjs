// PRODUCTION FRESHNESS AUDIT — fetches the live public site (not the build output) and fails on any superseded claim.
// Public content automation may not go live unless this passed recently (publisher + admin gate).
// Pure fetch; used by scripts/prod-audit.mjs (local) and by the server job `prod_audit`.

const PAGES = ["/", "/history", "/transparency", "/receipts", "/kit", "/print", "/drop", "/sitemap.xml", "/manifest.webmanifest", "/robots.txt"];

// [regex, why] — never allowed anywhere on the public site
const BANNED = [
  [/\bx\s*[·:–-]?\s*soon\b|\btelegram\s*[·:–-]?\s*soon\b|\bopening soon\b/i, "“X/Telegram soon” — accounts exist now"],
  [/anyone selling it now is a scam/i, "retired claim “anyone selling it now is a scam”"],
  [/\b(?:is|are)\s+fake\b/i, "calls other tokens fake (use “not affiliated”)"],
  [/check-?coin-?sol/i, "typo domain (CHECK spelling)"],
  [/(?:x|twitter)\.com\/chekcoin(?!sol)\b/i, "old X handle @chekcoin"],
  [/t\.me\/chekcoin(?!sol)\b/i, "old Telegram link t.me/chekcoin"],
  [/@chekcoin(?!sol)\b/i, "old handle @chekcoin"],
  [/chekchat/i, "old chat t.me/chekchat"],
];

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, (s) => (/application\/ld\+json/.test(s) ? s.replace(/<[^>]+>/g, " ") : " "))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

// Old-ticker mentions that are part of the dated build log (before the ticker decision) are history, not claims.
export function historicalTickerMentions(history, decidedOn) {
  const before = history.entries.filter((e) => e.date < decidedOn);
  return JSON.stringify(before).match(/\$CHEK(?![A-Za-z])/g)?.length ?? 0;
}

/**
 * @param {{ site:string, project:object, history:object, decidedOn?:string, fetchImpl?:Function }} o
 * @returns {Promise<{ ok:boolean, checkedAt:string, site:string, pages:object, problems:string[] }>}
 */
export async function auditProduction({ site, project, history, decidedOn = "2026-10-02", fetchImpl = fetch }) {
  const problems = [];
  const pages = {};
  const live = project.status === "live" && project.token.ca;
  const allowedOld = historicalTickerMentions(history, decidedOn);
  const bust = `?audit=${Date.now()}`; // skip any CDN copy: this must be what a visitor gets now

  for (const path of PAGES) {
    let res;
    let body = "";
    try {
      res = await fetchImpl(site + path + bust, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "cache-control": "no-cache" } });
      body = await res.text();
    } catch (e) {
      problems.push(`${path}: unreachable (${e.message})`);
      continue;
    }
    pages[path] = res.status;
    if (res.status !== 200) {
      problems.push(`${path}: HTTP ${res.status}`);
      continue;
    }
    const t = path.endsWith(".xml") || path.endsWith(".txt") || path.endsWith(".webmanifest") ? body : text(body) + " " + (body.match(/<meta[^>]+>/g) || []).join(" ");
    for (const [re, why] of BANNED) if (re.test(t)) problems.push(`${path}: ${why} — “${t.match(re)[0]}”`);
    const old = t.match(/\$CHEK(?![A-Za-z])/g)?.length ?? 0;
    // the dated build log (and its receipts) may quote the old ticker as history — nothing else may
    const histPage = path === "/history" || path === "/receipts";
    if (old > (histPage ? allowedOld : 0)) problems.push(`${path}: old ticker $CHEK ×${old}${histPage ? ` (only ${allowedOld} dated build-log mentions allowed)` : ""}`);
    if (!live && /\bbuilt on solana\b/i.test(t)) problems.push(`${path}: “Built on Solana” before launch (say “Launching on Solana”)`);
    if (path.startsWith("/") && !path.includes(".")) {
      const canonical = body.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1] ?? null;
      if (canonical && !canonical.startsWith(project.links.website)) problems.push(`${path}: canonical ${canonical} is not on ${project.links.website}`);
      const og = body.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/)?.[1] ?? null;
      if (og && !og.startsWith(project.links.website)) problems.push(`${path}: og:url ${og} is not on ${project.links.website}`);
    }
    if (path === "/") {
      if (!live && !/not launched yet/i.test(t)) problems.push("/: missing “Not launched yet”");
      if (!live && /[1-9A-HJ-NP-Za-km-z]{39,40}pump\b/.test(body)) problems.push("/: an address-like string appears before launch");
      if (live && !body.includes(project.token.ca)) problems.push("/: official CA missing");
      if (!/not affiliated with this project/i.test(t)) problems.push("/: missing “not affiliated with this project”");
      if (project.links.x && !body.includes(project.links.x.replace(/^https?:\/\//, ""))) problems.push(`/: no link to ${project.links.x}`);
      if (project.links.telegram && !body.includes(project.links.telegram.replace(/^https?:\/\//, ""))) problems.push(`/: no link to ${project.links.telegram}`);
      if (!t.includes(`$${project.ticker}`)) problems.push(`/: ticker $${project.ticker} not shown`);
    }
  }
  return { ok: problems.length === 0, checkedAt: new Date().toISOString(), site, pages, problems };
}
