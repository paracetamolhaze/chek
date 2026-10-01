// Content guards — deterministic checks every post passes before it can be published, whoever wrote it.
// They can BLOCK (never publish) or ESCALATE to review (owner approves). They never relax a level.
import { officialCa, project } from "./project.js";

const BASE58 = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const BLOCK = [
  [/\b(?:guarantee[ds]?|guaranteed)\b[^.\n]{0,40}\b(?:return|profit|gain|growth|price|pump|x\b|\d+x)/i, "promises a return / price"],
  [/\b(?:will|gonna|going to)\s+(?:moon|pump|100x|1000x|10x|go up|skyrocket)\b/i, "predicts price"],
  [/\b(?:passive income|dividends?|staking rewards|apy|apr)\b(?!\s*(?:—|-)?\s*(?:no|none))/i, "financial-return language"],
  [/\b(?:buy|ape)\s+(?:now|before|fast)\b|\bdon'?t miss\b|\blast chance\b|\bnot financial advice but\b/i, "FOMO / shilling"],
  [/\b(?:anything|anyone|any token|any \$?[A-Z]{3,6})\b[^.\n]{0,80}\b(?:is|are|be|selling)\b[^.\n]{0,30}\b(?:fake|scam)\b/i, "calls same-name tokens fake"],
  [/\bprice floor\b|\bfloor price\b|\bguaranteed demand\b/i, "floor / demand promise"],
  [/(?:bit\.ly|tinyurl\.com|t\.co\/|goo\.gl|cutt\.ly)/i, "link shortener"],
  [/\bseed phrase\b[^.\n]{0,40}\b(?:send|share|enter|dm)\b(?![^.\n]{0,30}\bnever\b)/i, "asks for a seed phrase"],
];

// Corporate / bot-like phrasing: AI drafts containing these are rejected and redrafted.
const BOTLIKE = [/exciting news/i, /we'?re thrilled/i, /stay tuned/i, /big things (?:are )?coming/i, /\bgame[- ]?changer\b/i, /\brevolutionar/i, /\bunlock the power\b/i, /🚀{2,}/];

const REVIEW = [
  [/\$CHEK\b[^.\n]{0,60}\b(?:price|mcap|market cap|chart|ath|volume|pump(?!\.fun|swap)|dump)\b|\b(?:price|mcap|market cap|chart)\b[^.\n]{0,60}\$CHEK\b/i, "talks about the CHEK price/market"],
  [/\bpartner(?:ship|ed|ing)?\b|\bcollab(?:oration)?\b|\blisting\b|\blisted on\b/i, "partnership / listing claim"],
  [/\b(?:lawsuit|sued|fraud|scammer|arrested|sec\b|cftc\b|investigation)\b/i, "legal / accusation topic"],
  [/\b(?:trump|biden|harris|election|politic\w*|senator|congress(?:man|woman)?|president|parliament|government)\b/i, "politics"],
];

export function addressesIn(text) {
  return [...String(text).matchAll(BASE58)].map((m) => m[0]).filter((s) => /\d/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s));
}

export function allowedAddresses(p = project()) {
  return new Set([officialCa(p), p.token.creatorWallet, p.token.treasuryWallet, p.token.creationTx].filter(Boolean));
}

// X counts every URL as 23 chars.
export function xLength(text) {
  return [...text.replace(/https?:\/\/\S+|(?:[a-z0-9-]+\.)+(?:app|fun|io|xyz|com|me|so|ag|org|net)(?:\/\S*)?/gi, "x".repeat(23))].length;
}

/**
 * @param {{platform:'x'|'telegram', parts:string[], origin:string, level:string, ack?:string[]}} item
 * @returns {{ ok:boolean, level:string, problems:string[] }}
 */
export function checkContent(item) {
  const problems = [];
  let level = item.level;
  const text = item.parts.join("\n\n");
  const ack = new Set(item.ack || []); // phrases a human already reviewed in seed content (e.g. lore quoting "100x guaranteed")

  // 1. CA guard — the most important rule: never publish an address that isn't ours.
  const allowed = allowedAddresses();
  for (const a of addressesIn(text)) if (!allowed.has(a)) problems.push(`BLOCK: unknown address ${a.slice(0, 6)}…`);
  if (/\bCA\b|contract address/i.test(text) && !officialCa() && /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text)) problems.push("BLOCK: CA mentioned before launch");

  for (const [re, why] of BLOCK) if (re.test(text) && !ack.has(why)) problems.push(`BLOCK: ${why}`);
  if (item.origin !== "seed") for (const re of BOTLIKE) if (re.test(text)) problems.push(`BLOCK: bot-like phrase ${re}`);
  for (const [re, why] of REVIEW) if (re.test(text) && !ack.has(why)) {
    problems.push(`REVIEW: ${why}`);
    if (level === "auto") level = "review";
  }

  // 2. Platform rules and limits
  if (item.platform === "x") {
    item.parts.forEach((p, i) => xLength(p) > 280 && problems.push(`BLOCK: part ${i + 1} is ${xLength(p)} chars`));
    item.parts.forEach((p, i) => (p.match(/\$[A-Za-z]{1,6}\b/g) || []).length > 1 && problems.push(`BLOCK: part ${i + 1} has more than one cashtag (X limit)`));
    if (/(^|\s)@(?!chekcoin\b)\w{2,15}/i.test(text)) problems.push("BLOCK: @mentions someone (unsolicited mentions are not allowed via the API)");
  }
  if (item.platform === "telegram") item.parts.forEach((p, i) => p.length > 4000 && problems.push(`BLOCK: part ${i + 1} too long for Telegram`));
  if (/\{\{[A-Z_]+\}\}/.test(text)) problems.push("BLOCK: unfilled placeholder");

  return { ok: !problems.some((p) => p.startsWith("BLOCK")), level, problems };
}
