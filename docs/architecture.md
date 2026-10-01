# Architecture — the CHEK autopilot

Goal: CHEK runs as an autonomous meme/community project. The owner only creates accounts, provides credentials once, signs blockchain transactions and approves sensitive posts. Everything else runs in production, with or without anyone's computer on.

## Map

```
 SOURCES                                AGENTS (server/lib)                        CHANNELS
 ─────────────────────────────          ─────────────────────────────────          ─────────────────
 project events (build log, commits) ─┐  RECEIPT ENGINE  receipts.js  ─┐
 Solana (creator wallet, fee vault)  ─┼─ ON-CHAIN AGENT  onchain.js   ─┤
 news feeds (verified list)          ─┼─ NEWS AGENT      news.js      ─┼─► CONTENT QUEUE ─► PUBLISHER ─► X
 lore / receipt jokes / polls        ─┼─ CONTENT ENGINE  engine.js    ─┤    queue.js         publisher.js  Telegram
 community (mentions — later)        ─┘  COMMUNITY AGENT (phase 2)    ─┘    + GUARDS            ▲          Website (Receipt Board)
                                                                            guards.js          │
                                         SCHEDULER jobs.js ── every 5 min (pg_cron) ───────────┘
                                         OWNER: Telegram bot (approve / reject, digest, /pause) + local Command Center
                                         AUDIT LOG · ALERTS · COSTS · BUDGET GUARD (core.js)
```

| Piece | Where | Cost |
|---|---|---|
| Website | Static Next.js export on Vercel | $0 on Hobby — see "Hosting terms" |
| Backend | Vercel Node functions `api/*.js` (fra1) | included |
| Database | Postgres, schema `chek` (dedicated Supabase project recommended) | $0 (Supabase Free) |
| Scheduler | Supabase pg_cron → `POST /api/cron` every 5 min; Vercel daily cron as backup | $0 |
| AI | Claude API (`claude-opus-5-5` by default, effort low/medium, structured outputs) | ~$10–15/month at default cadence; daily cap |
| X | Official API, pay-per-use | ~$4–10/month at ~3 posts/day (+$0.20 per post with a link) |
| Telegram | Official Bot API | $0 |
| Solana | Public RPC, read-only | $0 |
| Images | Rendered in-house from code (SVG → PNG) | $0 |

## Agents and their jobs

| Agent | Does | Frequency |
|---|---|---|
| Publisher | Due queue items → conditions → guards → owner review if needed → X / Telegram. One post per platform per tick, daily caps, min gap, late launch posts expire. | every tick |
| On-chain agent | Creator wallet + creator-fee vault: buys/sells/moves ≥ 0.01% of supply, fee claims → ON-CHAIN VERIFIED receipts (always with the tx) → disclosure posts. | 5 min |
| News agent | Verified feeds → relevance score → AI verdict where every claim must quote the source verbatim (checked in code) → draft with SOURCE / URL / PUBLISHED_AT / CHECKED_AT. Newsroom feeds: headline + link only. | fetch 2 h, evaluate 4 h |
| Content engine | Once a day: unposted project receipts → template posts; then 0–3 authored posts (memes, lore, receipt jokes, polls) avoiding repeats. Zero is a valid day. | daily |
| Receipt engine | Numbered receipts. `onchain` only with a tx; everything else `reported`. Build log becomes reported receipts. | on event |
| Digest | Evening summary to the owner's Telegram: posts, receipts, waiting approvals, spend. | daily |

## Approval levels

| Level | What | How |
|---|---|---|
| **AUTO** | memes, lore, build receipts, evidence-checked news, community updates, site updates, changelog, analytics, bug fixes | published when due if guards pass |
| **REVIEW** | anything mentioning the CHEK price/market, partnerships/listings, legal topics, politics, real people criticised, sensitive community situations, replies to big accounts | owner gets the text in Telegram with ✅ / ❌; nothing is published without ✅ |
| **MANUAL ONLY** | sending funds, swaps, selling creator tokens, treasury transactions, anything needing a wallet signature, ownership of critical infrastructure | never automated — the system holds no keys |

Guards are code, not prompts: they block unknown addresses (CA guard), price/return promises, calling same-name tokens "fake", bot phrases ("exciting news", "stay tuned"…), >1 cashtag or unsolicited @mentions on X, unfilled placeholders, over-length posts. A guard can only raise a level, never lower it.

## Content rules

- Mix target: 40% memes/lore · 25% community · 15% build · 10% transparency · 10% token info. Never BUY BUY BUY.
- Cadence: morning / day / evening slots with ±25 min jitter, plus event-driven posts. Caps: 6 X + 8 Telegram per day, ≥ 45 min apart.
- No invented news, no attributed words without a verbatim source quote, no fake screenshots, no fabricated quotes.
- Community content is always credited; never passed off as ours.
- X requires automated accounts to carry the **Automated** label and name the responsible human account (X developer guidelines, checked 2026-10-02). We comply — honesty is the brand; the tone stays human.

## Kill switches

- Owner in Telegram: `/pause` (off), `/dry` (decide + log, publish nothing), `/live`.
- Command Center: autopilot Off / Dry run / Live, per-platform toggles, approve/reject, budgets.
- Budget guard: paid actions stop when the daily or monthly budget is reached; an alert is raised once.

## Security

- No wallet keys anywhere in the system. Production can read the chain and post; it cannot move funds.
- The CA comes only from `config/project.json` (a commit) — the database can't change what the site shows, and the CA guard blocks any other address in posts.
- Secrets: generated app secrets and owner-provided credentials live only in Vercel env (sensitive); OAuth tokens obtained at runtime are AES-256-GCM encrypted in the database.
- Endpoints: cron (secret header), admin (bearer token, local dashboard only), Telegram webhook (secret token), X connect (short-lived signed link). Public endpoints are read-only.
- The database user should only reach schema `chek` (a dedicated project is simpler and safer than sharing).

## Hosting terms

Vercel's Hobby plan is for non-commercial personal use only; a project where the creator receives trading fees is financial gain under their definition. Pro is $20/month (as checked 2026-10-02). Decision: owner.

## Owner credentials (one time each)

| What | Where it goes | Unlocks |
|---|---|---|
| Database (dedicated Supabase project, or approval to use the existing store with a restricted role) | Vercel env `DATABASE_URL` | everything stateful |
| Telegram bot token (@BotFather) | Vercel env `TELEGRAM_BOT_TOKEN`; bot admin in channel (post + edit) and chat | Telegram autopilot, approvals, digest |
| X developer app (pay-per-use) Client ID/Secret | Vercel env `X_CLIENT_ID`, `X_CLIENT_SECRET`; then "Connect X" once | X autopilot |
| Anthropic API key (with a spend limit set in the console) | Vercel env `ANTHROPIC_API_KEY` | authored posts, news verdicts |
