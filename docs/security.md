# Security

## Secrets never enter this repository

- No seed phrases, private keys, wallet JSON files, Telegram sessions, bot tokens or API keys — not in code, not in config, not in commits.
- `.gitignore` blocks `.env*`, `*.pem`, `*.key`, `*keypair*.json`, `wallet*.json`, `secrets/`.
- The Vercel deploy token is read at runtime from a file **outside** the repo (`VERCEL_TOKEN_FILE`).
- `scripts/deploy.mjs` refuses to upload anything that looks like a PEM key, an env token, a Telegram bot token or a 64-byte Solana keypair array.

## The public website

- Static HTML/CSS/JS (Next.js static export) on Vercel. No server code, no database, no admin panel, no write endpoints.
- It never asks to connect a wallet, sign a message or approve anything — and says so on /transparency.
- Strict security headers: CSP (`default-src 'self'`, no third-party scripts), `X-Frame-Options: DENY`, `nosniff`, HSTS, strict referrer and permissions policies.
- Fonts and images are self-hosted: visitors' browsers talk only to the site itself.

## One source for every official link and the CA

- `config/project.json` holds the name, ticker, contract address and every official link. Website, dashboard and post templates all read from it.
- The site refuses to show a contract address unless `status` is `live` **and** the value is a valid base58 Solana address — no placeholders that could be mistaken for a real CA.
- Changing the CA = editing that file → a public commit with its own timestamp → a redeploy.

## The owner dashboard

- Runs only on the owner's PC: listens on `127.0.0.1`, rejects other Host headers (DNS-rebinding) and cross-origin POSTs (CSRF), serves files only from content folders.
- Read-only towards the blockchain: it checks a mint through a public RPC and Pump.fun's public API. It never holds or asks for a key.
- Before publishing a CA it verifies on-chain: the account is a token mint, the symbol is CHEK, mint and freeze authority are disabled, and it finds the creation transaction.

## Wallet hygiene for the owner

- Use a dedicated wallet for the project; its address becomes public as the creator wallet.
- Never type a seed phrase or private key into a website, a form, a DM or a chat — including any "support" that contacts you.
- Pump.fun's own terms: they never ask for keys, seeds, one-time codes or login credentials.
- Turn on 2FA for X, Telegram, GitHub and Vercel. Use a password manager.

## Anti-scam rules we publish

1. Admins never DM first.
2. We never ask for a seed phrase, private key or "wallet validation".
3. No presale, no whitelist, no "early access".
4. One CA — the same on the site, the pinned X post and the pinned Telegram message.
5. No fake partnerships, audits or listings.
6. Build log entries are added when things happen, never backdated. Git history documents it — but local commit times can technically be rewritten, so we rely on several independent receipts: the public repository, X and Telegram timestamps, and after launch the blockchain.
7. A name or ticker proves nothing. Other tokens may use the same name or ticker; only the contract address published at the same minute on the site, the pinned X post and the pinned Telegram message identifies ours.

## Reporting

Found a vulnerability or an account pretending to be us? Tell us in the Telegram chat or on X. Never send anyone funds or keys to "fix", "verify" or "claim" anything.
