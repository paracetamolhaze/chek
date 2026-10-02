# Architecture — the CHEK autopilot

Goal: CHEK runs as an autonomous meme/community project. The owner only creates accounts, authorizes them once, signs blockchain transactions and approves sensitive posts. Everything else runs on its own.

## Map

```
 SOURCES                                AGENTS (server/lib)                        CHANNELS
 ─────────────────────────────          ─────────────────────────────────          ─────────────────
 project events (build log, commits) ─┐  RECEIPT ENGINE  receipts.js  ─┐
 Solana (creator wallet, fee vault)  ─┼─ ON-CHAIN AGENT  onchain.js   ─┤
 news feeds (verified list)          ─┼─ NEWS AGENT      news.js      ─┼─► CONTENT QUEUE ─► PUBLISHER ─► X
 lore / receipts / claim receipts    ─┼─ CONTENT ENGINE  engine.js    ─┤    queue.js         publisher.js  Telegram channel
 mentions, bot submissions           ─┘  COMMUNITY       jobs.js/bot  ─┘    + GUARDS            ▲          Website (Receipt Board)
                                                                            guards.js          │
                                         SCHEDULER jobs.js ── every 5 min (Supabase pg_cron) ──┘
                                         AI JOBS ai-jobs.js ◄──► PC AGENT agent/run.mjs ──► Claude (owner's subscription)
                                         LAUNCH launch.js ◄── PC agent launch watcher (creator wallet) / dashboard
                                         OWNER: Telegram bot (✅/❌, digest, /pause /dry /live) + local Command Center
                                         AUDIT LOG · ALERTS · COSTS · BUDGET GUARD · DRY-RUN LOG · PRODUCTION AUDIT
```

| Piece | Where | Cost |
|---|---|---|
| Website | Static Next.js export on Vercel (Hobby — owner decision) | $0 |
| Backend | Vercel Node functions `api/*.js` (8 of 12) | $0 |
| Database | Postgres, schema `chek`, Supabase project dedicated to CHEK | $0 (Free) |
| Scheduler | Supabase pg_cron + pg_net → `POST /api/cron` every 5 min; Vercel daily cron as backup | $0 |
| AI | Claude through the owner's subscription via the local Claude bridge already running on the PC (shared, one CHEK job at a time, waits when busy): the cloud queues prompts in `chek.ai_jobs`, the **PC agent** runs them with Claude Code and returns the text; the cloud validates it (zod) before use. No AI key in the cloud. `ANTHROPIC_API_KEY` stays possible as a paid fallback. | $0 extra |
| X | Owner chose browser automation (like the owner's other project); setting it up for CHEK was blocked by the Claude Code safety system (non-API automation of x.com). Ready alternatives: official API (pay-per-use) or one-tap posting from the Telegram bot. At launch the bot always sends the owner the exact X post as a fallback. | API: ~$0.015 per post without a link |
| Telegram | Official Bot API (webhook) | $0 |
| Solana | Public RPC, read-only | $0 |
| Images | Rendered in-house from code (SVG → PNG, resvg) | $0 |

**What keeps running with the PC off:** the site, the Receipt Board, the Receipt Generator, the Telegram bot, scheduled posts, the on-chain watcher, news collection. **What needs the PC:** AI-authored drafts (jobs wait or expire) and the instant launch watcher (fallback: paste the CA once in the dashboard).

## Agents and their jobs

| Agent | Does | Frequency |
|---|---|---|
| Publisher | Due queue items → conditions → guards → owner review if needed → X / Telegram. One post per platform per tick, daily caps, min gap, late launch posts expire. In dry mode: logs the exact post instead. | every tick |
| On-chain agent | Creator wallet + creator-fee vault: buys/sells/moves ≥ 0.01% of supply, fee claims → ON-CHAIN VERIFIED receipts (always with the tx) → disclosure posts. | 5 min |
| News agent | Verified feeds → relevance score → AI verdict where every claim must quote the source verbatim (checked in code) → draft with SOURCE / URL / PUBLISHED_AT / CHECKED_AT. Newsroom feeds: headline + link only. | fetch 2 h, evaluate 4 h |
| Content engine | Once a day: unposted project receipts → template posts; then 0–3 authored posts (memes, lore, claim receipts, polls) avoiding repeats and the planned calendar. At most one post in three about the token. Zero is a valid day. | daily |
| Community | X mentions that ask for a receipt → a reply with the receipt image in REVIEW (the person opted in by mentioning us; one reply per mention). Bot submissions offered for the channel (with or without credit) → REVIEW. | 15 min / on message |
| Receipt bot | Anyone who writes to @chekcoinsol_bot gets their claim printed as a receipt + a Share-on-X button. Never writes first. | on message |
| Production audit | Fresh fetch of every public page: no stale ticker, no “X/Telegram soon”, no retired claims, no typo domain, canonical domain right. Live posting is refused if it fails or is older than 6 h (24 h for the publisher). | 6 h + after each deploy |
| Launch | Verifies the mint on-chain (creator wallet, ticker, authorities) → API switches the site → X post → Telegram pin → receipts; T+ posts anchored to the real minute. | once |
| Digest | Evening summary to the owner's Telegram. | daily |

## Approval levels

| Level | What | How |
|---|---|---|
| **AUTO** | memes, lore, build receipts, evidence-checked news, community updates, site updates, changelog, analytics, bug fixes | published when due if guards pass |
| **REVIEW** | anything mentioning the CHEK price/market, partnerships/listings, legal topics, politics, real people criticised, every reply on X, community submissions, quote posts | owner gets the text + image in Telegram with ✅ / ❌; nothing is published without ✅ |
| **MANUAL ONLY** | sending funds, swaps, selling creator tokens, treasury transactions, anything needing a wallet signature, ownership of critical infrastructure | never automated — the system holds no keys |

Guards are code, not prompts: they block unknown addresses (CA guard), price/return promises, the old ticker `$CHEK`, the typo domain, “built on Solana” before launch, calling same-name tokens "fake", bot phrases, >1 cashtag or unsolicited @mentions on X, unfilled placeholders, over-length posts. A guard can only raise a level, never lower it.

## X automation rules we follow (as checked 2026-10-01, help.x.com “Automation rules”, updated April 2026)

- Only API-based automation. X lists “non-API-based forms of automation, such as scripting the X website” as a Don't and warns it can lead to permanent suspension.
- No automated likes, no bulk/aggressive follows, no keyword-based replies, no duplicate posts, no automated posts about trending topics.
- Replies only to people who mentioned us / asked (opt-in), one per interaction, and AI-written replies stay REVIEW (AI reply bots need X's prior written approval).
- Automated account label + the responsible human account in the profile.

## Content rules

- Mix target: 40% memes/lore · 25% community · 15% build · 10% transparency · 10% token info. Never BUY BUY BUY.
- Most posts carry no link (the site lives in the profile and the pinned post).
- Cadence: morning / day / evening slots with ±25 min jitter, plus event-driven posts. Caps: 6 X + 8 Telegram per day, ≥ 45 min apart.
- No invented news, no attributed words without a verbatim source quote, no fake screenshots, no fabricated quotes.
- Community content is opt-in and credited; never passed off as ours.
- Metrics (impressions, profile visits, follows, site visits from X/Telegram, channel size, receipts printed/shared, submissions) improve the **format**; they are never published as social proof.

## Dry run

`autopilot = dry`: everything runs exactly as live, but the publisher marks posts `dry_published` and writes the full post (text, media URL, source, reasons, level) to `chek.dry_log`; guard rejections, review requests, approvals and expiries are logged too. `autopilot = on` is refused until a ≥ 24 h dry run has finished, the production audit passes and the owner is linked in Telegram.

## Kill switches

- Owner in Telegram: `/pause` (off), `/dry`, `/live` (refused while the live gate is closed).
- Command Center: autopilot Off / Dry run / Live, per-platform toggles, approve/reject, budgets.
- Budget guard: paid actions stop when the daily or monthly budget is reached; an alert is raised once.

## Security

- No wallet keys anywhere. Production can read the chain and post; it cannot move funds.
- A CA is accepted only after the server's own on-chain check: a Pump.fun coin with ticker CHEKD created by the creator wallet the owner announced privately before launch. The PC agent can report a launch but cannot make the server accept a wrong coin.
- Secrets live in Vercel env (sensitive) or the git-ignored `private/` folder on the owner's PC; OAuth tokens obtained at runtime are AES-256-GCM encrypted in the database. The PC agent's token can only take AI jobs, return answers and report a launch.
- Endpoints: cron (secret), admin (bearer token, local dashboard only), agent (bearer token), Telegram webhook (secret token), X connect (short-lived signed link). Public endpoints are read-only except the anonymous usage counter.

## Hosting terms

Vercel's Hobby plan is for non-commercial personal use. The owner decided to stay on Hobby (2026-10-01); Cloudflare Pages is a free alternative that allows commercial use if this ever needs to change.
