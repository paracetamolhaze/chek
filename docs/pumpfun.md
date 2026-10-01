# Pump.fun — verified facts (checked 2026-10-01)

Sources: official pump.fun pages (`/docs/fees` updated 2026-05-20, `/create`, `/docs/terms-and-conditions` updated 2026-09-25, `/docs/wallet-login-changes`), the official `pump-fun/pump-public-docs` GitHub repo, the official help center, and read-only checks of fresh mints on Solana mainnet. Re-check before launch day — fees and options change.

## Cost

| What | Cost |
|---|---|
| Platform creation fee | **0 SOL** |
| Create **without** a buy | Coin starts off-chain; the first buyer puts it on-chain and pays ~0.0055 SOL rent |
| Create **with** a creator buy | ~0.007–0.01 SOL rent + network fees (≈ $1–1.2 at $118/SOL) **+ the buy itself** |
| Creator buy fee | normal 1.25% trading fee, no extra fee |
| Graduation fee | 0.015 SOL, taken at migration (not paid by the creator up front) |

Budget for the technical part: **≤ 0.05 SOL (≈ $6)**, well under the $20 limit. The owner's own buy is separate and not part of that budget.

Our launch flow assumes the coin is **on-chain at T+0** (so the dashboard can verify the CA before it's published). A creator buy at creation does that; its size is the owner's decision and is published either way.

## Login and wallet (changed 2026-09-25)

- Web login is email / Google / Apple / GitHub (Privy). Browser-wallet sign-in was retired.
- The pump.fun account wallet is the creator wallet. Fund it with SOL before launch.
- Pump.fun never asks for keys in DMs, email, X or other sites.

## Create form (live, 2026-10-01)

| Field | Limit | Our value |
|---|---|---|
| Name | < 32 chars | `CHEK` |
| Ticker | ≤ 10 chars (UI) | `CHEK` |
| Description | < 2000 chars, optional | see `docs/launch-plan.md` |
| Image | required, jpg/png/gif/webp, ≤ 15 MB, ≥ 1000×1000, 1:1 | `brand/social/token-1000.png` |
| Banner | optional, 1500×500, ≤ 5 MB | `brand/social/x-header-1500x500.png` |
| Website / X / Telegram | optional | from `config/project.json` |
| Pair | SOL / USDC / custom | **SOL** |
| Creator rewards to | Creator / Holders | **Creator** (holder payouts would read as a yield promise) |
| Mayhem mode | on/off, increases supply | **OFF** |
| Buy during creation | optional | owner's decision |

**Name, ticker, image, description, banner and social links cannot be changed after creation.** X and Telegram must exist before the coin is created.

## Token after creation (measured on 10 fresh mints)

Token-2022, 6 decimals, supply 1,000,000,000, mint authority none, freeze authority none, metadata immutable. UI-created mints end in `pump`. 793.1M on the curve, 206.9M reserved for migration; graduation at ~85 SOL in the curve → PumpSwap, LP burned.

## Fees

Bonding curve 1.25% = 0.95% protocol + 0.30% creator. PumpSwap tiers from 1.25% down to 0.30% by market cap. Creator fees are claimable any time; the claim costs only the network fee.

## Geography

Prohibited by Pump.fun's terms (§32): United Kingdom, Cuba, Iran, North Korea, Syria, **Russia**, Belarus, Crimea/Donetsk/Luhansk, plus sanctioned countries; perps also exclude the US and Ontario. VPN evasion is prohibited. The terms also exclude anyone for whom use is illegal under local law.

## URL formats

- Coin: `https://pump.fun/coin/<mint>`
- Solscan: `https://solscan.io/token/<mint>` · Solana Explorer: `https://explorer.solana.com/address/<mint>`
- RugCheck: `https://rugcheck.xyz/tokens/<mint>` · DexScreener: `https://dexscreener.com/solana/<mint>`
- Bubblemaps: `https://v2.bubblemaps.io/map?address=<mint>&chain=solana` · Birdeye: `https://birdeye.so/solana/token/<mint>`
- Jupiter: `https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=<mint>`
- Public (unofficial) API: `https://frontend-api-v3.pump.fun/coins-v2/<mint>`

## Telegram holder role (planned)

Free options exist for small groups (Ancla free up to 25 members, Collab.Land starter up to 25). None documents Token-2022 support explicitly — test with our mint before announcing the feature. Until then it stays PLANNED on the site.
