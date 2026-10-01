import raw from "../../../config/project.json";

export type Project = {
  name: string;
  ticker: string;
  mascot: string;
  tagline: string;
  oneLiner: string;
  network: string;
  status: "prelaunch" | "live";
  token: {
    ca: string | null;
    createdAt: string | null;
    launchPlatform: string;
    totalSupply: string | null;
    decimals: number | null;
    tokenProgram: string | null;
    mintAuthority: string | null;
    freezeAuthority: string | null;
    creatorWallet: string | null;
    creatorBuy: string | null;
    treasuryWallet: string | null;
    otherAllocations: string;
  };
  launch: { plannedAt: string | null; launchedAt: string | null };
  links: {
    website: string | null;
    x: string | null;
    telegram: string | null;
    telegramChat: string | null;
    github: string | null;
  };
};

export const project = raw as Project;

// A real Solana address is base58, 32–44 chars. Anything else is never shown as a CA.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const ca: string | null =
  project.status === "live" && project.token.ca && BASE58.test(project.token.ca) ? project.token.ca : null;

export const isLive = ca !== null;

export const cashtag = `$${project.ticker}`;

export const siteUrl = project.links.website ?? "https://rcpt.example";

// Independent places to check the token. Built only from the verified CA.
export function verifyLinks(address: string) {
  return [
    { name: "Solscan", what: "Token, supply, holders, creation tx", href: `https://solscan.io/token/${address}` },
    { name: "Solana Explorer", what: "Official Solana Foundation explorer", href: `https://explorer.solana.com/address/${address}` },
    { name: "RugCheck", what: "Mint/freeze authority, holder concentration", href: `https://rugcheck.xyz/tokens/${address}` },
    { name: "DexScreener", what: "Pairs and trades", href: `https://dexscreener.com/solana/${address}` },
    { name: "Bubblemaps", what: "Holder clusters", href: `https://v2.bubblemaps.io/map?address=${address}&chain=solana` },
    { name: "Pump.fun", what: "Official coin page", href: `https://pump.fun/coin/${address}` },
  ];
}

export const tradeUrl = ca ? `https://pump.fun/coin/${ca}` : null;

export function walletUrl(address: string) {
  return `https://solscan.io/account/${address}`;
}

export function shortAddress(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function formatUtc(iso: string, withTime = false) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date} · ${time} UTC`;
}

export type Social = { key: "x" | "telegram" | "github"; label: string; href: string | null };

export const socials: Social[] = [
  { key: "x", label: "X", href: project.links.x },
  { key: "telegram", label: "Telegram", href: project.links.telegram },
  { key: "github", label: "GitHub", href: project.links.github },
];
