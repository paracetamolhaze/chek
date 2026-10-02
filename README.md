# CHEK

**Receipts or it didn't happen.**

<!-- status:start (generated from config/project.json — do not edit by hand) -->
| | |
|---|---|
| **What is CHEK** | A meme coin project launching on Solana with one rule: every claim comes with a receipt. The mascot, Chek, is a slip of thermal paper that only prints what it can prove. |
| **Token symbol** | $CHEKD (the brand is CHEK) |
| **Current status** | **PRE-LAUNCH** |
| **Official website** | https://www.chekcoinsol.xyz |
| **X** | https://x.com/chekcoinsol |
| **Telegram** | https://t.me/chekcoinsol |
| **Token** | **NOT LAUNCHED** |
| **Contract address (CA)** | **DOES NOT EXIST YET** |
| **Public since** | 01 Oct 2026 (UTC) |

> The official CHEK token has not launched yet. Any token using this name or ticker before our launch is not affiliated with this project.
<!-- status:end -->

> A name or ticker is never proof. The only exact identifier is the official Solana contract address, published at the same minute on the website, in the pinned X post and in the pinned Telegram message.

CHEK is a meme coin: no intrinsic value, no yield, no promised returns. Nothing here is financial advice.

## Why this repository is public

It is one of several independent receipts. The website, the build log and every change to the contract address live here, so anyone can see *what* changed and *when*. Git history documents the build — but commit times can technically be rewritten, so cross-check it against the other receipts: X and Telegram post timestamps, the Vercel-hosted site, and after launch the blockchain itself.

## Layout

```
config/project.json      single source of truth: name, ticker, status, CA, every official link, platform facts
content/history.json     the build log shown on /history (entries added only when things happen)
content/pumpfun.json     values for the Pump.fun create form
content/x/queue.json     prepared X posts (status, slot, publishAfter, asset)
content/telegram/        prepared Telegram posts and channel/chat texts
content/memes, mascot/   rendered images for posts
brand/                   mascot + logo source (SVG in code), fonts (OFL), social images
website/                 Next.js static site (pages; no wallet code, no secrets)
api/                     Vercel functions: cron, admin, public data, Telegram webhook, X OAuth
server/lib/              backend: receipts, content queue, publisher, guards, agents (news, on-chain, content)
shared/                  pure helpers shared by scripts, dashboard and backend
dashboard/               owner launch dashboard + command center — runs locally only (127.0.0.1)
docs/                    concept, brand, tokenomics, launch plan, checklist, security, Pump.fun facts, lore, architecture, voting
scripts/                 asset renderer, deploy, checks, screenshots
```

## Run

```bash
npm install && npm --prefix website install
npm run assets      # render PNGs (avatars, token image, OG, memes) with local Chrome
npm run build       # static export → website/out
npm run check       # pre-launch check + consistency audit against the live site
npm run dashboard   # owner dashboard on http://127.0.0.1:4747
```

Deploy: `VERCEL_TOKEN_FILE=<path outside the repo> npm run deploy`.

## Security

- No seed phrases, private keys, bot tokens, cookies or API secrets in this repo, the website or the build. `.env*` is ignored; deploy and check scripts refuse anything that looks like a key.
- Pages are static HTML. The backend holds no wallet keys; write endpoints need a secret. The site never asks for a seed phrase, a token approval or a transaction.
- The CA can only change through `config/project.json` → a commit → a redeploy.

## License

Code: MIT. Mascot and brand assets: free to use for memes and fan art; don't use them to impersonate the project. Fonts: SIL OFL (see `brand/fonts`).
