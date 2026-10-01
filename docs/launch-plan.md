# Launch plan

All times UTC. Real dates get written into the build log only when things happen. Brand: **CHEK**. Token symbol: **$CHEKD**.

## Before anything is posted

1. **24 h dry run** of the whole autopilot (scheduler, agents, guards, approvals) — it publishes nothing and logs every post it *would* have published (text, image, source, reasons) plus every rejected post. Report → owner.
2. **Fresh production audit** (`node scripts/prod-audit.mjs`): the live site has no stale ticker, no “X/Telegram soon”, no retired claims, no typo domain, correct canonical domain. Live posting is refused while it fails or is older than 6 h.
3. Owner confirms the launch time → it must be ≥ 26 h away, so the announcement goes out ≥ 24 h before the mint.

## Pre-launch calendar (compressed: 2 days + launch day)

Day 1 = the first day of public posting (`schedule.d1`, proposed 2026-10-03). Shift everything with one command:

```bash
node scripts/schedule.mjs --d1 2026-10-03
```

| When | X | Telegram channel | Theme |
|---|---|---|---|
| D1 12:30 | — | tg-101 channel intro (pin) | origin |
| D1 13:00 | x-101 “day N — a receipt started printing on oct 1” | — | origin |
| D1 16:30 | x-102 the slip reads the internet → CLAIM … VOID | — | origin / lore |
| D1 18:00 | — | tg-102 the bot prints receipts | utility |
| D1 20:00 | x-103 build log so far | — | build |
| D2 12:00 | x-201 print your own receipt → /print | — | utility (growth loop) |
| D2 13:00 | — | tg-201 the villains | lore |
| D2 15:00 | x-202 THE SHREDDER | — | lore |
| D2 17:00 | x-203 how $CHEKD launches — thread (**pinned**) | tg-202 same, in full | transparency |
| D2 20:30 | x-204 pics vs receipts | — | meme |
| T−26 h | x-205 launch time announcement | tg-203 | announcement (≥ 24 h before) |
| T−20 h | x-206 THE COUPON | — | lore |
| T−5 h | x-301 names prove nothing | — | transparency |
| T−30 m | x-302 reminder | tg-301 | optional |
| T−5 m | x-303 final reminder | tg-302 | |

Plus whatever the content engine adds (0–3 posts a day, quality over quantity) and news drafts that pass the evidence check. The token is not the subject of most posts; most posts carry no link (the site is in the profile and the pin).

## Launch minute

There is **no waiting period** after the mint: Pump.fun coins are visible to trading terminals immediately, so the community gets the official address as fast as is safe.

| When | Who | What |
|---|---|---|
| T−2 h | system | Launch watcher arms (PC agent): it watches the announced creator wallet (kept private until launch). |
| T0 | **owner** | Creates CHEK on Pump.fun with the creator buy (≈ $200 in SOL, recalculated right before) in the same transaction. Signs in the wallet. |
| T0 + seconds | system | Creation tx confirmed → the server verifies it on-chain itself: Pump.fun coin, ticker CHEKD, created by the announced creator wallet, mint/freeze authority. Anything else is refused. |
| T0 + seconds | system | 1. **Website**: the CA box switches via the API. 2. **X** launch post (x-310). 3. **Telegram** launch message + pin (tg-310). 4. Transparency / Creator Receipt switch to chain data. |
| T0 + ~1–2 min | system | Static site rebuilt and redeployed with the verified facts (commit with its own timestamp); production audit re-run. |
| T+12 m | system | First **ON-CHAIN VERIFIED** launch receipt (x-311, tg-311). |
| T+40 m | system | **Creator receipt**: creator wallet, SOL spent, CHEKD received, % of supply, explorer link (x-312, tg-312). |
| T+2 h | system | What's live (x-320). |
| T+6 h | owner approves | Receipt of the Week (x-321). |
| T+24 h | owner approves | Honest recap — real numbers only (x-322, tg-320). |

If the watcher misses the create transaction (PC off), the owner pastes the CA into the dashboard once — the same verification and the same sequence run.

The owner pins the X post by hand (X has no pin API); the system raises an alert with the link.

## Pump.fun form

All values live in [`content/pumpfun.json`](../content/pumpfun.json) (name **CHEK**, ticker **CHEKD**, description, image, banner, pair **SOL**, creator rewards → **Creator**, holder rewards **OFF**, Mayhem **OFF**); website / X / Telegram come from `config/project.json`. Coin data is **immutable** after creation — the FINAL PUMP.FUN FORM card is generated only when the domain and every link are final.

Before pressing create: open pump.fun only by typing `pump.fun` yourself (no links from DMs or search ads), re-check fees and the create form **on launch day** (`pump.fun/docs/fees`, `pump.fun/create`) and update `config/project.json → platform` if anything changed.

**Mint is blocked until all of these are final:** website (canonical domain), X, Telegram, token image, banner, description, name, ticker (`npm run check` → "READY TO MINT"). We don't promise an exact network cost in advance; after the mint the real creation transaction and its real cost are published.

## After launch: content mix

40% memes/lore · 25% community (receipts people print, opt-in and credited) · 15% build updates · 10% transparency · 10% token info. Never BUY BUY BUY. No countdown hype, no charts.
