# Pre-launch checklist

Run the automated part any time: `npm run check` (✓ ok · ✗ failed · · waiting on the owner) and `node scripts/prod-audit.mjs` (fresh fetch of the live site).
Status below as of 2026-10-01, 23:40 UTC. READY TO MINT = every line ✓. Exact check counts live only in `content/checks.json`.

## Website

- [x] Production on HTTPS: https://www.chekcoinsol.xyz (canonical, confirmed by the owner 2026-10-02); every other domain redirects there
- [x] All pages 200: /, /history, /transparency, /receipts, /kit, /print; 404 page works
- [x] Metadata, OG/Twitter card, favicon, manifest, sitemap, robots, security headers
- [x] Contract shown as NOT LAUNCHED YET; no address-like placeholder anywhere
- [x] “Launching on Solana” before launch (never “Built on Solana”)
- [x] Receipt Generator `/print` + share cards `/r` + Telegram receipt bot
- [x] Canonical domain confirmed: switched everywhere in one commit (`scripts/set-domain.mjs`)
- [x] Typo domain `checkcoinsol.xyz` only redirects (never canonical)
- [ ] Analytics — optional (Vercel Web Analytics, then `site.analytics: true`)

## Brand & token data

- [x] Brand `CHEK`, token symbol `$CHEKD` (owner decision; collision report in `docs/concept.md`)
- [x] Token image 1000×1000 1:1 (`brand/social/token-1000.png`), banner 1500×500
- [x] Token description < 2000 chars (`content/pumpfun.json`)
- [x] Pump.fun settings: pair SOL · creator rewards → Creator · holder rewards OFF · Mayhem OFF
- [x] Creator: 0% free allocation; ≈ $200 creator buy at creation, recalculated into SOL right before; real values from the chain after
- [ ] Re-check pump.fun fees/options on launch day

## Socials

- [x] X @chekcoinsol — existing founder-owned account, repurposed for CHEK (documented in /history and on /transparency)
- [x] Telegram channel t.me/chekcoinsol “CHEK | Official”; bot @chekcoinsol_bot is an admin
- [ ] X profile: name, bio, avatar, header, link, “Automated” label (see `content/x/queue.json → profile`)
- [ ] Public GitHub repo (sanitized history, see `docs/repository-sanitization.md`) → link saved

## Autopilot

- [ ] Database migrated (Supabase project dedicated to CHEK), pg_cron every 5 min
- [ ] Telegram webhook + owner linked (`/start <code>` once)
- [ ] PC agent running (AI writer + launch watcher)
- [ ] 24 h dry run finished, report reviewed
- [ ] Production audit passing (fresh)
- [ ] X connection (decision pending: official API vs. other)

## Content

- [x] 63 X posts and 19 Telegram posts: D1–D5, the Receipt Drop (five drop posts on X a day — about three for the main X drop to one pointing to the separate Telegram drop), the launch sequence and T+4d (`content/x/queue.json`, `content/telegram/queue.json`)
- [x] 6 brand videos (`content/animations/v0*.mp4`, `node scripts/render-videos.mjs`) + an asset library for the content engine (`content/assets.json`)
- [x] 10 memes, 5 mascot images; every shared image carries “CHEK · @chekcoinsol”
- [ ] Launch time confirmed by owner (date: 6 Oct 2026; time placeholder 2026-10-06 15:00 UTC; must be ≥ 24.5 h away when confirmed)

## Launch day — owner

- [ ] pump.fun opens from the owner's network
- [ ] Logged into pump.fun; wallet funded with SOL (≈ $200 buy + fees)
- [ ] Creator wallet address announced privately to the system (dashboard → Mint)
- [ ] FINAL PUMP.FUN FORM card received; every field copied from it

## Security ✓

- [x] No keys/seeds/tokens in repo, site or build (`npm run check` scans tracked files)
- [x] `.env*` and `private/` ignored; deploy refuses key-like content
- [x] One config for every official link and the CA (`config/project.json`)
- [x] The server publishes a CA only after its own on-chain check (creator wallet + ticker + authorities)
- [x] Dashboard local-only (127.0.0.1)
