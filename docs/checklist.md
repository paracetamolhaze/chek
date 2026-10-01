# Pre-launch checklist

Run the automated part any time: `npm run check` (✓ ok · ✗ failed · · waiting on the owner).
Status below as of 2026-10-01, 20:10 UTC. READY TO MINT = every line ✓.

## Website — automated ✓

- [x] Production on HTTPS: https://chekcoin.vercel.app (Vercel, HSTS)
- [x] All pages 200: /, /history, /transparency, /kit; 404 page works
- [x] Desktop / tablet / mobile checked by screenshots, no horizontal scroll
- [x] Speed (live, throttled 4G + 4× slower CPU): LCP 1.8 s, CLS 0
- [x] Metadata: title, description, OpenGraph + Twitter card (1200×630)
- [x] Favicon (.ico 16/32/48, SVG), apple-touch icon, web manifest, sitemap, robots
- [x] Security headers: CSP, X-Frame-Options, nosniff, HSTS, permissions policy
- [x] Contract shown as NOT LAUNCHED YET; no address-like placeholder anywhere
- [x] Scam warnings: "we never DM first", "always verify the Contract Address"
- [x] Launch state rehearsed (real pump.fun coin in a throwaway copy): CA + copy button, VIEW TOKEN, official record, 6 verify links
- [ ] Analytics — waiting: one click in Vercel (see runbook), then `site.analytics: true`

## Brand & token data

- [x] Name `CHEK`, ticker `$CHEK` (name check done, `docs/concept.md`)
- [x] Token image 1000×1000 1:1 (`brand/social/token-1000.png`), banner 1500×500
- [x] Token description (`docs/launch-plan.md`, < 2000 chars)
- [x] Supply expectations documented (1B, Token-2022, authorities disabled) — **final values read from chain at launch**
- [x] Launch platform: Pump.fun; facts and fees re-checked 2026-10-01 (`docs/pumpfun.md`)
- [ ] Re-check pump.fun fees/options on launch day

## Socials — owner

- [ ] X @chekcoin created, avatar + header + bio + link set, 2FA on
- [ ] Telegram channel t.me/chekcoin + chat t.me/chekchat, avatars, descriptions, pinned rules
- [ ] Links saved in the dashboard (→ site rebuilds with them)
- [ ] Public GitHub repo (owner picks the account) → link saved

## Content — ready ✓

- [x] 26 X posts (all ≤ 280 chars), 2 threads, launch post, transparency thread, 24h recap
- [x] 11 Telegram posts + channel/chat descriptions, rules, welcome text, CA pin template
- [x] 10 memes, 5 mascot images, 1 reaction GIF/MP4 + 2 scripted animation ideas
- [x] Schedule: D1…D5 pre-launch, T-3h…T+4d (`content/schedule.json`)
- [ ] Launch date/time confirmed by owner (proposed 2026-10-07 15:00 UTC)

## Launch day — owner

- [ ] pump.fun opens from the owner's network
- [ ] Logged into pump.fun (email/Google — wallet sign-in was retired 2026-09-25); wallet funded with SOL
- [ ] Dashboard running: `VERCEL_TOKEN_FILE=… npm run dashboard`
- [ ] All tiles green except TOKEN/CA
- [ ] Form filled from `docs/launch-plan.md`; Mayhem OFF; pair SOL; rewards → Creator

## Security ✓

- [x] No keys/seeds/tokens in repo, site or build (`npm run check` scans tracked files)
- [x] `.env*` ignored; deploy refuses key-like content
- [x] One config for every official link and the CA (`config/project.json`)
- [x] Dashboard local-only (127.0.0.1, host/origin checks)
- [x] Backup: git history + `git bundle` copy outside the project folder
