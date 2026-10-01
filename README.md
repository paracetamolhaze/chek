# CHEK ($CHEK)

**Receipts or it didn't happen.**

A meme coin on Solana with one rule: every claim comes with a receipt. The mascot is Chek — a slip of thermal paper that only prints what it can prove.

> $CHEK is a meme coin. No intrinsic value, no yield, no promised returns. Nothing here is financial advice.

- Website: https://chekcoin.vercel.app
- Status: **pre-launch — no token exists yet.** Anyone selling $CHEK today is a scam.
- Official contract address: published on the website, the pinned X post and the pinned Telegram message at the same minute. All three must match.

## Why this repository is public

It is part of the receipt. The website, the build log and every change to the contract address live here, so anyone can check *what* changed and *when* — commit timestamps are not edited.

## Layout

```
config/project.json      single source of truth: name, ticker, CA, every official link
content/history.json     the build log shown on /history (entries added only when things happen)
content/x/queue.json     prepared X posts (status, publishAfter, asset)
content/telegram/        prepared Telegram posts
content/memes, mascot/   rendered images for posts
brand/                   mascot + logo source (SVG in code), fonts (OFL), brand guide
website/                 Next.js static site (no server, no wallet code, no secrets)
dashboard/               owner launch dashboard — runs locally only (127.0.0.1)
docs/                    concept, brand, tokenomics, launch plan, checklist, security
scripts/                 asset renderer, deploy, screenshots
```

## Run

```bash
npm install && npm --prefix website install
npm run assets      # render PNGs (avatars, token image, OG, memes) with local Chrome
npm run build       # static export → website/out
npm run dashboard   # owner dashboard on http://127.0.0.1:4747
```

Deploy: `VERCEL_TOKEN_FILE=<path outside the repo> npm run deploy`.

## Security

- No seed phrases, private keys, bot tokens or API secrets in this repo, the website or the build. `.env*` is ignored; the deploy script refuses to upload anything that looks like a key.
- The public site is static HTML. It has no write endpoints and never touches a wallet.
- The CA can only change through `config/project.json` → a public commit → a redeploy.

## License

Code: MIT. Mascot and brand assets: free to use for memes and fan art; don't use them to impersonate the project. Fonts: SIL OFL (see `brand/fonts`).
