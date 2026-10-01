// Share card for a visitor's claim receipt: /r?c=<claim>[&n=<name>][&s=<stamp>]  (vercel.json rewrites /r → /api/r)
// Social crawlers read the Open Graph / X card tags (image = /api/image?claim=…&format=wide, 1200×630); people are sent on
// to /print?c=… with the same claim filled in. Invalid claims go to an empty /print. Absolute URLs come from
// config/project.json → links.website only. Everything printed into the page is HTML-escaped.
import { project } from "../server/lib/project.js";
import { STAMP_COPY, claimQuery, checkClaim } from "../shared/claim.mjs";

export const maxDuration = 10;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const handleOf = (x) => {
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})/i.exec(x ?? "") ?? /^@?([A-Za-z0-9_]{1,15})$/.exec(x ?? "");
  return m ? `@${m[1]}` : "@chekcoinsol";
};
const config = () => {
  try {
    return project();
  } catch {
    return {};
  }
};

export async function GET(request) {
  const url = new URL(request.url);
  const q = url.searchParams;
  const r = checkClaim({ claim: q.get("c") ?? "", name: q.get("n") ?? "", stamp: q.get("s") ?? "" });
  if (!r.ok) return new Response(null, { status: 302, headers: { location: "/print", "cache-control": "public, max-age=300" } });

  const p = config();
  const site = String(p.links?.website || url.origin).replace(/\/+$/, "");
  const name = p.name || "CHEK";
  const handle = handleOf(p.links?.x);
  const short = claimQuery(r);
  const page = `/print?${short}`;
  const card = `${site}/r?${short}`;
  const image = `${site}/api/image?${claimQuery(r, { short: false })}&format=wide`;
  const title = `A receipt from ${name}`;
  const desc = `“${r.claim}”${r.name ? ` — ${r.name}` : ""} · ${r.stamp} · printed by a visitor`;
  const alt = `Receipt: “${r.claim}” — proof: ${STAMP_COPY[r.stamp].proof.toLowerCase()}, status: ${r.stamp}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${esc(card)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(card)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${esc(handle)}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(alt)}">
<meta http-equiv="refresh" content="0; url=${esc(page)}">
<meta name="theme-color" content="#141311">
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#141311;color:#f4f0e6;font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;padding:16px;box-sizing:border-box">
<main>
<p style="margin:0 0 6px;letter-spacing:.2em;font-size:12px;color:#a7a193">${esc(name)} · RECEIPT</p>
<p style="margin:0 0 18px;max-width:36ch">“${esc(r.claim)}”</p>
<p style="margin:0"><a href="${esc(page)}" style="color:#f6e05e">View the receipt</a> · <a href="/print" style="color:#f4f0e6">Print your own</a></p>
</main>
</body>
</html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=604800" },
  });
}
