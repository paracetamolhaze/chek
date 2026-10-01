# Changelog

Dates are UTC. Entries are added when the change ships — never backdated.

## 2026-10-01 (autopilot foundation, from 22:00 UTC)

- Backend (Vercel functions + Postgres schema chek): numbered receipts, content queue with AUTO/REVIEW levels, publisher, code-level content guards, audit log, alerts, costs with budget guard.
- Agents: news desk (verified feeds, evidence quotes checked against the source), on-chain watcher (creator wallet, creator-fee vault), daily content engine.
- Telegram Bot API and X API (OAuth 2.0 PKCE) adapters; owner approvals via Telegram buttons; nothing connected yet.
- Receipt Board (/receipts), Creator Receipt, phased utility and roadmap, value proposition on the home page.
- Receipt image renderer (4 formats, scannable barcodes) and /api/image.
- Command Center and Mint tab in the local dashboard (live pump.fun calculator, pre-mint preview).
- Pre-launch check at 22:21 UTC: 36 passed, 12 waiting on the owner, 0 failed (of 48).

## 2026-10-01 (audit pass, from 21:30 UTC)

- Look-alike tokens: “not affiliated with this project” instead of “fake” on the site, FAQ, Transparency, X/Telegram drafts and README.
- “A name or ticker is not proof — only the contract address published at the same minute on the site, the pinned X post and the pinned Telegram message.”
- Git history is described as documenting the build, not as absolute proof; several independent receipts (repo, X, Telegram, chain).
- Roadmap X/Telegram status fixed; Public since 01 Oct 2026 shown; platform values “as checked 01 Oct 2026”.
- Automatic consistency audit (10 rules) inside npm run check; results saved to content/checks.json.
- Personal data removed from current files; public-repo scrub prepared (not published).
- Pre-launch check at 21:30 UTC: 35 passed, 8 waiting on the owner, 0 failed (of 43).

## 2026-10-01

- Project started from an empty folder.
- Concept: three candidates (receipt, odd sock, traffic cone) → receipt mascot chosen.
- Name check: RECEIPTS / $RCPT dropped (ticker already used by an existing X account, recent "receipt" coins on other chains) → **CHEK / $CHEK**.
- Mascot "Chek" drawn as code (`brand/mascot.mjs`): 7 expressions, 6 poses, logo mark.
- Website v0: static Next.js site — hero, 10 receipt sections, build log page. Contract shown as NOT LAUNCHED YET.
- Claimed `chekcoin.vercel.app`.
- Brand system: logo mark, villains (The Shredder, The Coupon), avatars, X header, token image, OG card, meme kit.
- Website v1: /transparency, /kit, 404, manifest, sitemap. Mascots as cached SVGs; mobile LCP 1.8 s, CLS 0.
- Pump.fun facts re-checked (fees, form limits, Token-2022, authorities); creator fee disclosed.
- Content bank: 26 X posts, 11 Telegram posts, 10 memes, 5 mascot images, reaction GIF; schedule D1–D5 + launch T±.
- Owner launch dashboard (local only) with on-chain CA verification; launch minute rehearsed on a real coin in a throwaway copy, one bug fixed.
- Docs: brand guide, tokenomics draft, launch plan, security, lore, checklist; `npm run check` at 20:10 UTC: 27 passed, 6 waiting on the owner, 0 failed.
