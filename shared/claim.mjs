// Public Receipt Generator: claim rules. Pure, no dependencies — the /print page (browser) and the server
// (/api/image, /api/r, server/lib/render.js) import this same file, so what the preview accepts is what the server prints.
//   checkClaim({ claim, name, stamp }) → { ok, claim, name, stamp, problems, by: { claim, name, stamp }, dropped }
//   claimCode(claim)                   → "CHK-7F3A2C" (FNV-1a, deterministic) — receipt number and barcode

export const STAMPS = ["UNVERIFIED", "VOID", "PROOF PENDING", "NO RECEIPT"];
export const DEFAULT_STAMP = "UNVERIFIED";
export const LIMITS = { claimMin: 3, claimMax: 140, nameMax: 24 };

// What each stamp prints on the receipt (shared so the browser preview and the server image say the same thing)
// and how Chek reacts. Chek is always skeptical: these receipts are claims nobody has proven.
export const STAMP_COPY = {
  UNVERIFIED: { proof: "NONE PROVIDED", mood: { expr: "skeptic", pose: "point", prop: "magnifier" } },
  VOID: { proof: "NONE PROVIDED", mood: { expr: "angry", pose: "point", prop: "stamp" } },
  "PROOF PENDING": { proof: "STILL WAITING", mood: { expr: "skeptic", pose: "hip" } },
  "NO RECEIPT": { proof: "NOT FOUND", mood: { expr: "skeptic", pose: "point", prop: "magnifier" } },
};

export const DISCLAIMER = "printed by a visitor · not a statement by CHEK";

// Characters the receipt fonts can print (Martian Mono coverage, = server/fonts/fonts.json). Everything else
// (emoji, CJK, zero-width and bidi control characters) is dropped before any check, so the checks see what prints.
const PRINTABLE = [
  [32, 126], [160, 263], [266, 275], [278, 283], [286, 291], [294, 299], [302, 307], [310, 328], [330, 333], [336, 347],
  [350, 382], [1025, 1025], [1028, 1028], [1030, 1031], [1038, 1038], [1040, 1103], [1105, 1105], [1108, 1108],
  [1110, 1111], [1118, 1118], [8209, 8209], [8211, 8212], [8216, 8218], [8220, 8222], [8224, 8226], [8230, 8230],
  [8240, 8240], [8249, 8250], [8364, 8364], [8372, 8372], [8381, 8381], [8470, 8470], [8482, 8482], [8592, 8595], [8722, 8722],
];
const printable = (cp) => PRINTABLE.some(([a, b]) => cp >= a && cp <= b);
const RAW_MAX = 2000; // longer raw input is rejected before any pattern runs

const len = (s) => Array.from(s).length;

// NFC, whitespace (incl. tabs/newlines) → one space, unprintable characters dropped, trimmed.
export function normalize(s) {
  const t = String(s ?? "")
    .slice(0, RAW_MAX * 2)
    .normalize("NFC")
    .replace(/\s+/g, " ");
  const all = Array.from(t);
  const kept = all.filter((c) => printable(c.codePointAt(0)));
  return { text: kept.join("").replace(/ {2,}/g, " ").trim(), dropped: all.length - kept.length };
}

// Stamp input: case-insensitive, "proof-pending" / "proof_pending" / "Proof Pending" all mean PROOF PENDING.
export function stampOf(s) {
  const t = String(s ?? "")
    .toUpperCase()
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || DEFAULT_STAMP;
}
export const stampSlug = (stamp) => stampOf(stamp).toLowerCase().replace(/ /g, "-");

// For pattern checks only: lower case, common look-alikes folded to Latin (Cyrillic homoglyphs, leetspeak).
const FOLD = { а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", к: "k", м: "m", т: "t", н: "h", в: "b", ё: "e" };
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i", "|": "i" };
const fold = (s) =>
  s
    .toLowerCase()
    .replace(/[аеорсухікмтнвё]/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
// leetspeak is folded only inside words that have a letter ("p0rn"), never in plain numbers ("7175")
const leet = (s) => s.replace(/\S+/g, (w) => (/[a-z]/.test(w) ? w.replace(/[013457@$!|]/g, (c) => LEET[c] ?? c) : w));

// ── Rules. Each: [test(text, folded, leeted), reason]. Kept short and obvious on purpose. ──
const TLDS =
  "com|net|org|io|xyz|gg|fun|app|co|me|ly|sh|ai|dev|site|online|live|tv|cc|link|click|finance|money|exchange|pro|vip|top|info|biz|ru|uk|cn|tk|ml|ga|cf|gq|sol|eth|club|store|shop|win|bet|cash|claims?|gift|rewards?|airdrop";
const URL_RE = [
  /\b(?:https?|ftp|hxxps?):\/\//i,
  /\bwww\s*\./i,
  /\b[a-z0-9][a-z0-9-]*\.[a-z]{2,24}\//i, // something.tld/
  new RegExp(`\\b[a-z0-9][a-z0-9-]*\\.(?:${TLDS})\\b`, "i"), // something.com
  /\[\s*\.\s*\]|\(\s*\.\s*\)|\bdot\s+(?:com|io|xyz|net|org|fun|app)\b/i, // example[.]com, example dot com
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/, // IP address
];
// Solana address / signature: a base58 run of 32+ that looks random (a digit, or mixed case with many distinct
// characters) — so "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH" is still a scream, not an address.
const looksBase58 = (text) =>
  (text.match(/[1-9A-HJ-NP-Za-km-z]{32,}/g) ?? []).some((r) => /\d/.test(r) || (/[a-z]/.test(r) && /[A-Z]/.test(r) && new Set(r).size >= 12));
const ADDRESS_RE = [
  /\b0x[0-9a-f]{40}\b/i, // EVM address
];
// long hex with a digit in it: tx hashes, private keys
const looksHex = (text) => (text.match(/[0-9a-f]{32,}/gi) ?? []).some((r) => /\d/.test(r) && /[a-f]/i.test(r));
const HANDLE_RE = /@[a-z0-9_]/i;
const CASHTAG_RE = /\$[a-z]/i;
const WALLET_RE = [
  /\b(?:seed|secret|recovery|backup)\s*(?:phrase|words?)\b/,
  /\b(?:mnemonic|private\s*keys?|priv\s*keys?|keystore)\b/,
  /\b(?:connect|verify|validate|sync|restore|recover|unlock|link)\s+(?:your\s+|ur\s+|the\s+|a\s+)?wallets?\b/,
  /\bwallets?\s+(?:connect|validation|verification|sync|recovery|restore|drainer)\b/,
  /\bdrainers?\b/,
  /\bsend\b(?:\s+\S+){0,3}?\s+(?:sol|eth|btc|usdc|usdt|crypto|coins?|tokens?|nfts?)\b/,
  /\b(?:claim|free)\s+(?:your\s+|the\s+|a\s+)?(?:airdrop|tokens?|sol|crypto|mint|nft)s?\b/,
  /\bdouble\s+your\s+(?:sol|eth|btc|crypto|money|tokens?)\b/,
];
const CHEK_RE = /\b(?:chek|chekd|cheks|chekcoin|chekcoinsol)\b/;
const PRICE_RE =
  /\b\d+(?:[.,]\d+)?\s*x\b|\bx\s*\d+\b|\b(?:moon\w*|pump\w*|price\w*|ath|lambo\w*|mcap|market\s*cap|marketcap|millionaires?|rich|profit\w*|gains?|returns?|invest\w*|buy\w*|ape[sd]?|aping|hold\w*|hodl\w*|bags?|worth|rocket\w*|send\w*|guarantee\w*|financial\s+freedom|next\s+(?:bonk|wif|pepe|shib|doge|popcat))\b|\$\s*\d|\b\d+\s*[kmb]\b/;
const ENDORSE_RE = /\b(?:verif\w*|approv\w*|endors\w*|official\w*|partner\w*|certif\w*|audit\w*|backed|sponsor\w*|confirm\w*|legit)\b/;
const SLUR_RE =
  /\b(?:n+i+g{2,}(?:a+h?|e+r+|u+h|az|ers?|as|uz)s?|f+a+g{1,2}(?:o|i)+t+s?|kikes?|spics?|gooks?|wetbacks?|trann(?:y|ies)|retard(?:s|ed)?|ragheads?|beaners?)\b/;
const SEX_RE =
  /\b(?:porn\w*|nudes?|sex|sexy|sexual\w*|sexting|xxx|nsfw|blow\s*jobs?|hand\s*jobs?|cum|cumshots?|cumming|pussy|pussies|tits|titties|boobs?|penis\w*|vagina\w*|dildos?|onlyfans|hentai|horny|orgasm\w*|masturbat\w*|rape[sd]?|raping|rapists?|pedos?|pedophil\w*|paedophil\w*|molest\w*|incest|milfs?|bdsm)\b/;

const REASON = {
  url: "No links or website addresses.",
  address: "No wallet addresses or transaction hashes.",
  handle: "No @handles. Write a plain name instead.",
  cashtag: "No $cashtags.",
  wallet: "No seed phrases, keys, wallet or send-crypto requests.",
  price: "No price talk about CHEK.",
  endorse: "A visitor receipt can't say CHEK verified, endorsed or partnered with anything.",
  dirty: "Keep it clean: no slurs or sexual content.",
};

// Problems in one free-text field.
function scan(text) {
  if (!text) return [];
  const f = fold(text);
  const l = leet(f);
  const out = [];
  if (URL_RE.some((r) => r.test(text) || r.test(f))) out.push(REASON.url);
  if (looksBase58(text) || looksHex(text) || ADDRESS_RE.some((r) => r.test(text))) out.push(REASON.address);
  if (HANDLE_RE.test(text)) out.push(REASON.handle);
  if (CASHTAG_RE.test(text)) out.push(REASON.cashtag);
  if (WALLET_RE.some((r) => r.test(f))) out.push(REASON.wallet);
  if (CHEK_RE.test(f) && PRICE_RE.test(f)) out.push(REASON.price);
  if (CHEK_RE.test(f) && ENDORSE_RE.test(f)) out.push(REASON.endorse);
  if (SLUR_RE.test(f) || SLUR_RE.test(l) || SEX_RE.test(f) || SEX_RE.test(l)) out.push(REASON.dirty);
  return out;
}

const RESERVED_NAME = /\b(?:chek|chekd|cheks|chekcoin|chekcoinsol|official)\b/;
const LETTERS = /[0-9A-Za-zÀ-ɏЀ-џ]/g;

export function checkClaim({ claim, name, stamp } = {}) {
  const by = { claim: [], name: [], stamp: [] };
  const rawClaim = String(claim ?? "");
  const rawName = String(name ?? "");
  const c = normalize(rawClaim);
  const n = normalize(rawName);
  const st = stampOf(stamp);

  if (rawClaim.length > RAW_MAX) by.claim.push(`Too long: keep the claim under ${LIMITS.claimMax} characters.`);
  else if (!c.text) by.claim.push("Write a claim.");
  else if (len(c.text) < LIMITS.claimMin || (c.text.match(LETTERS) ?? []).length < LIMITS.claimMin)
    by.claim.push(`Too short: at least ${LIMITS.claimMin} letters.`);
  else if (len(c.text) > LIMITS.claimMax) by.claim.push(`Too long: ${len(c.text)}/${LIMITS.claimMax} characters.`);
  if (rawClaim.length <= RAW_MAX) by.claim.push(...scan(c.text));

  if (rawName.length > RAW_MAX || len(n.text) > LIMITS.nameMax) by.name.push(`Name: ${LIMITS.nameMax} characters max.`);
  else if (n.text) {
    if (RESERVED_NAME.test(fold(n.text))) by.name.push("Name: can't be CHEK or an official account.");
    by.name.push(...scan(n.text).map((r) => `Name: ${r.charAt(0).toLowerCase()}${r.slice(1)}`));
  }

  if (!STAMPS.includes(st)) {
    by.stamp.push(
      /VERIF|CONFIRM|APPROV|OFFICIAL|CERTIF|LEGIT/.test(st.replace(/^UN/, ""))
        ? "VERIFIED stamps are reserved for official CHEK receipts."
        : `Pick a stamp: ${STAMPS.join(", ")}.`,
    );
  }

  const problems = [...new Set([...by.claim, ...by.name, ...by.stamp])];
  return {
    ok: problems.length === 0,
    claim: c.text,
    name: n.text,
    stamp: STAMPS.includes(st) ? st : DEFAULT_STAMP,
    problems,
    by,
    dropped: c.dropped + n.dropped,
  };
}

// FNV-1a 32-bit over the normalized, lower-cased claim → "CHK-" + 6 hex digits.
export function claimCode(claim) {
  const bytes = new TextEncoder().encode(normalize(claim).text.toLowerCase());
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `CHK-${h.toString(16).toUpperCase().padStart(8, "0").slice(0, 6)}`;
}

// Query string for a claim. short: /print and /r (c, n, s); long: /api/image (claim, name, stamp).
// Empty name and the default stamp are left out so links stay short.
export function claimQuery({ claim, name, stamp } = {}, { short = true } = {}) {
  const p = new URLSearchParams();
  p.set(short ? "c" : "claim", String(claim ?? ""));
  if (name) p.set(short ? "n" : "name", String(name));
  const st = stampOf(stamp);
  if (st !== DEFAULT_STAMP) p.set(short ? "s" : "stamp", stampSlug(st));
  return p.toString();
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
// "02 OCT 2026 · UTC" — the day the receipt was printed.
export function printDate(d = new Date()) {
  let t = new Date(d);
  if (Number.isNaN(t.getTime())) t = new Date();
  return `${String(t.getUTCDate()).padStart(2, "0")} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()} · UTC`;
}
