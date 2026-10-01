import history from "../../../content/history.json";
import { cashtag as T, notAffiliated, onlyTheAddress, project } from "./project";
import type { Expression, Pose } from "../../../brand/mascot.mjs";
import type { TagKind } from "@/components/receipt";

const M = project.mascot;
const hasCommunity = Boolean(project.links.telegram || project.links.x);

export type HistoryEntry = {
  date: string;
  title: string;
  detail?: string;
  proof?: { label: string; href?: string };
  correction?: { date: string; note: string };
};
export const buildLog = (history.entries as HistoryEntry[]).slice().sort((a, b) => b.date.localeCompare(a.date));

export const lore: { ch: string; title: string; body: string; expr: Expression; pose: Pose; prop?: "stamp" | "magnifier" }[] = [
  {
    ch: "01",
    title: "Register #4",
    body: "03:14 AM. A corner store, lights off. Register #4 wakes up and prints a receipt for a purchase nobody made. Then it keeps printing.",
    expr: "sleep",
    pose: "down",
  },
  {
    ch: "02",
    title: "The first line",
    body: `The slip tears itself off and reads the internet. “Partnership soon.” “Audit coming.” “100x guaranteed.” Not one comes with proof. ${M} prints its first line: CLAIM ....... VOID.`,
    expr: "skeptic",
    pose: "point",
    prop: "magnifier",
  },
  {
    ch: "03",
    title: "The Shredder",
    body: `Every story needs a villain. The Shredder eats evidence — deleted posts, wiped sites, vanished devs. ${M} has seen what it leaves behind: confetti.`,
    expr: "shock",
    pose: "up",
  },
  {
    ch: "04",
    title: "The Coupon",
    body: `Loud, shiny, always expiring. “100X OFF! TODAY ONLY!” ${M} has one rule for coupons: read the fine print. Then don't.`,
    expr: "angry",
    pose: "point",
    prop: "stamp",
  },
  {
    ch: "05",
    title: "Still printing",
    body: `${M} is still printing. Every real thing the community does becomes a new line. The roll is long. That's the point.`,
    expr: "happy",
    pose: "up",
  },
];

export const why = [
  { k: "Honest label", v: `It's a meme coin and we say so. No fake utility, no “ecosystem”, no road to riches.` },
  { k: "Proof, not promises", v: "Every claim comes with a receipt — a commit, a post, a transaction. Several independent receipts beat one." },
  { k: "History in public", v: `Public since day one (${new Date(`${project.publicSince}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}). Build-log lines are added when things happen, never after; repository and post timestamps document them.` },
  { k: "Fun first", v: `Memes, lore and challenges around a character worth following — even if you never buy a single ${T}.` },
];

export const utility: { title: string; body: string; status: TagKind; href?: string; note?: string }[] = [
  { title: "Receipt Board", body: "Every significant project action as a numbered receipt. On-chain ones link to the transaction; reported ones say so.", status: "live", href: "/receipts" },
  { title: "Read the build log", body: "Every step since day one, dated, with its receipt.", status: "live", href: "/history" },
  { title: "Grab the meme kit", body: `${M} in every mood, the villains, logo and stamps.`, status: "live", href: "/kit" },
  {
    title: "Join the community",
    body: "Memes, lore drops and updates on X (@chekcoinsol) and Telegram (t.me/chekcoinsol).",
    status: hasCommunity ? "live" : "planned",
    note: hasCommunity ? undefined : "Opens before launch",
  },
  {
    title: "Receipt Generator",
    body: "Turn any claim into a CHEK receipt — “JOHN STILL OWES ME 20 BUCKS”. Free for everyone, no wallet, made to share. Also in Telegram: write to @chekcoinsol_bot.",
    status: "live",
    href: "/print",
  },
  {
    title: "Proof of Hold",
    body: `Prove you hold ${T} by signing a plain message with your wallet and get a shareable Verified Holder receipt. No seed phrase, no token approval, no transaction.`,
    status: "planned",
    note: "Phase 3",
  },
  {
    title: "Holder votes",
    body: `Holders vote on what ${M} prints next: memes, lore, new characters, site features. Community participation — not ownership.`,
    status: "planned",
    note: "Phase 4 · voting design published first",
  },
  {
    title: "Holder Desk",
    body: "Badges, holder-only templates, early drops, community tasks. Wallet sign-in, no passwords.",
    status: "planned",
    note: "Phase 4",
  },
  {
    title: "Meme Generator",
    body: `${M}, The Shredder and The Coupon in ready templates, square and vertical, for X and Telegram.`,
    status: "planned",
    note: "Phase 5",
  },
  {
    title: "Receipt of the Week",
    body: "Post the most absurd real receipt you have. The best one gets printed into the lore.",
    status: "planned",
    note: "Starts after launch",
  },
  {
    title: "Community bounties",
    body: "Part of the project budget may fund meme contests, art and dev bounties. Every real payout is published as a receipt. No regular payouts, no yield.",
    status: "planned",
    note: "Only when funded — announced with a receipt",
  },
  {
    title: "Holder drops",
    body: "Collectible receipts, badges and profile assets. For fun — no financial value promised.",
    status: "planned",
  },
];

export const roadmap: { phase: string; title: string; items: { t: string; s: TagKind }[] }[] = [
  {
    phase: "00",
    title: "Origin",
    items: [
      { t: "Concept, brand & mascot", s: "done" },
      { t: "Website, build log, Receipt Board", s: "done" },
      { t: "X + Telegram accounts", s: hasCommunity ? "done" : "next" },
      { t: "Public launch on Pump.fun", s: project.status === "live" ? "done" : "next" },
    ],
  },
  {
    phase: "01",
    title: "Receipts on autopilot",
    items: [
      { t: "Autonomous X + Telegram publishing (with owner approval for sensitive posts) — 24 h dry run first", s: "next" },
      { t: "On-chain receipts: creator fees, creator wallet, project payouts", s: "next" },
      { t: "News desk — verified sources only", s: "next" },
    ],
  },
  {
    phase: "02",
    title: "Receipt Generator",
    items: [
      { t: "Public Receipt Generator + shareable images", s: "done" },
      { t: "Receipt bot in Telegram", s: "done" },
      { t: "Community submissions (opt-in, always credited)", s: "next" },
    ],
  },
  {
    phase: "03",
    title: "Proof of Hold",
    items: [
      { t: "Wallet verification (sign a message, nothing else)", s: "later" },
      { t: "Verified Holder receipt", s: "later" },
      { t: "Holder statistics", s: "later" },
    ],
  },
  {
    phase: "04",
    title: "Holder Desk",
    items: [
      { t: "Community voting", s: "later" },
      { t: "Holder Desk + holder-only templates", s: "later" },
    ],
  },
  {
    phase: "05",
    title: "Expand the world",
    items: [
      { t: "Meme Generator", s: "later" },
      { t: "New characters, deeper lore", s: "later" },
      { t: "Collabs — announced only when real", s: "later" },
    ],
  },
];

export const faq: { q: string; a: string }[] = [
  {
    q: `Is ${T} an investment?`,
    a: `No. ${T} is a meme coin. It has no intrinsic value, no yield and no promised returns. Its price can go to zero. Don't buy what you can't afford to lose.`,
  },
  {
    q: "Is there a presale or a team allocation?",
    a: `No presale, no whitelist, no free team allocation (0%). The plan is a fair launch on Pump.fun, where everyone buys from the same bonding curve. The creator makes one public buy at creation (target ≈ $200) from the creator wallet — the exact SOL spent, ${T} received and share of supply are read from the creation transaction and shown in Tokenomics and on the Transparency page.`,
  },
  {
    q: "When is the launch?",
    a: "The date and time will be announced on X and Telegram at least 24 hours before. This site updates the minute the token exists.",
  },
  {
    q: "How do I know the contract address is real?",
    a: `${onlyTheAddress} The commit that adds it to this site documents it too. If anything doesn't match — don't buy.`,
  },
  {
    q: `Other tokens called ${project.name} already exist. Are they yours?`,
    a: `No. ${notAffiliated} They are independent — not necessarily scams, just not ours.`,
  },
  {
    q: "Has the contract been audited?",
    a: "No. It will be a standard Pump.fun token and we don't claim audits we don't have. After launch you can check mint and freeze authority yourself on RugCheck or Solscan.",
  },
  {
    q: "Will there be buybacks or burns?",
    a: "No promises. If anything like that ever happens, it'll be announced with a transaction link — a receipt.",
  },
  {
    q: `What does holding ${T} give me?`,
    a: `Participation in the community: holder votes on what ${M} prints next, holder-only templates and a Verified Holder receipt (all planned — see what's live above). It does not give ownership of anything, dividends, financial rights, or legal governance.`,
  },
  {
    q: "Who runs the X and Telegram accounts?",
    a: "An automated system run by the project owner. It writes and publishes routine posts on its own; posts about the CHEK price, partnerships, people or anything sensitive wait for the owner's approval. Every automatic action is logged. The X account @chekcoinsol is an existing account of the founder, renamed and repurposed for CHEK — it was not created for CHEK, so its join date is older than the project.",
  },
  {
    q: "Who is behind it?",
    a: "An independent creator building in public. No VCs, no paid shill groups. Everything we do goes into the build log.",
  },
  {
    q: `Someone DMed me about ${T}.`,
    a: "That's a scam. We never DM first, and we never ask for a seed phrase, a private key or “wallet validation”.",
  },
];

export const houseRules = [
  "We never DM first.",
  "We never ask for a seed phrase, private key or “wallet validation”.",
  "No presale, no whitelist, no “early access”. Ever.",
  "One contract address — the same here, in the pinned post on X and in the pinned Telegram message. If they don't match, don't buy.",
  "A name or ticker proves nothing. Other tokens may use the same name or ticker; they are not affiliated with us. Only the address counts.",
  "No fake partnerships, audits or listings. If it's not linked, it didn't happen.",
  "Build log entries are added when things happen, never backdated. The public repository, X and Telegram timestamps — and after launch the blockchain — document it. Several independent receipts beat one.",
];
