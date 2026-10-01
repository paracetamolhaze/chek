import history from "../../../content/history.json";
import { cashtag as T, project } from "./project";
import type { Expression, Pose } from "../../../brand/mascot.mjs";
import type { TagKind } from "@/components/receipt";

const M = project.mascot;
const hasCommunity = Boolean(project.links.telegram || project.links.x);

export type HistoryEntry = { date: string; title: string; detail?: string; proof?: { label: string; href?: string } };
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
  { k: "Proof, not promises", v: "Every claim on this site links to something you can check — a commit, a post, a transaction." },
  { k: "History in public", v: "The build log starts on day one. Dates are added when things happen, never after. Git history backs it up." },
  { k: "Fun first", v: `Memes, lore and challenges around a character worth following — even if you never buy a single ${T}.` },
];

export const utility: { title: string; body: string; status: TagKind; href?: string; note?: string }[] = [
  { title: "Read the build log", body: "Every step since day one, each with a receipt.", status: "live", href: "/history" },
  { title: "Grab the meme kit", body: `${M} in every mood, logo and stamps. Make your own memes.`, status: "live", href: "/kit" },
  {
    title: "Join the community",
    body: "Memes, lore drops and launch updates on X and Telegram.",
    status: hasCommunity ? "live" : "planned",
    note: hasCommunity ? undefined : "Opens before launch",
  },
  {
    title: "Receipt of the Week",
    body: "Post the most absurd real receipt you have. The best one gets printed into the lore.",
    status: "planned",
    note: "Starts when the community opens",
  },
  {
    title: "The Long Receipt",
    body: "A public, ever-growing receipt on this site. Each community milestone becomes a line item.",
    status: "planned",
  },
  {
    title: "Holder role",
    body: `Verified ${T} holders get a role in the Telegram chat.`,
    status: "planned",
    note: "Needs a verification bot — after launch",
  },
  {
    title: "Lore votes",
    body: `Holders vote on what ${M} itemizes next.`,
    status: "planned",
    note: "Voting tool not chosen yet",
  },
  {
    title: "Digital drops",
    body: "Receipt art for the community. Collectibles for fun — no financial value promised.",
    status: "planned",
  },
];

export const roadmap: { phase: string; title: string; items: { t: string; s: TagKind }[] }[] = [
  {
    phase: "01",
    title: "Origin",
    items: [
      { t: "Concept, brand & mascot", s: "done" },
      { t: "Website v1 + build log", s: "done" },
      { t: "X and Telegram open", s: hasCommunity ? "done" : "now" },
      { t: "Pre-launch: lore, memes, transparency", s: "next" },
      { t: "Public launch on Pump.fun", s: project.status === "live" ? "done" : "next" },
    ],
  },
  {
    phase: "02",
    title: "Build the world",
    items: [
      { t: "Receipt of the Week challenge", s: "later" },
      { t: "New lore chapters", s: "later" },
      { t: "The Long Receipt page", s: "later" },
      { t: "Community voting experiments", s: "later" },
      { t: "Holder role in Telegram", s: "later" },
    ],
  },
  {
    phase: "03",
    title: "Expand",
    items: [
      { t: "Collabs with other meme communities — announced only when real", s: "later" },
      { t: "Digital drops", s: "later" },
      { t: "New formats: animations, IRL receipt prints", s: "later" },
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
    a: "No presale, no whitelist, no team mint. The plan is a fair launch on Pump.fun, where everyone buys from the same bonding curve. If the creator wallet buys at launch, the wallet and the amount will be listed in Tokenomics.",
  },
  {
    q: "When is the launch?",
    a: "The date and time will be announced on X and Telegram at least 24 hours before. This site updates the minute the token exists.",
  },
  {
    q: "How do I know the contract address is real?",
    a: "It must match in three places: this website, the pinned post on X and the pinned message in Telegram. The commit that added it to this site is public too. If anything doesn't match — don't buy.",
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
  "No fake partnerships, audits or listings. If it's not linked, it didn't happen.",
  "Build log dates are added when things happen. Git history proves it.",
];
