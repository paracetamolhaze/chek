# Launch plan

All times UTC. Real dates get written into the build log only when things happen.

## Pre-launch (proposed: 5 days of public history before the token)

The account day is **D1**. Proposed D1 = 2026-10-02 → launch D6 = **2026-10-07 15:00 UTC** (17:00 Berlin · 11:00 New York). Shift everything with one command if accounts open later:

```bash
node scripts/schedule.mjs --d1 2026-10-03 --launch 2026-10-08T15:00:00Z
```

| Day | Theme | X | Telegram |
|---|---|---|---|
| D1 | Brand appears | x-001 03:14 AM · x-002 first line · x-003 pics vs receipts | — |
| D2 | Website | x-004 building · **x-005 site link (pin)** · x-006 $CHEK in 10s | — |
| D3 | Community opens | x-007 build log · x-008 mechanics · x-009 telegram open | tg-001 pin · tg-002 rules · tg-004 open |
| D4 | Lore + memes | x-010 The Shredder · x-011 The Coupon · x-012 vibe chek | tg-005 villains |
| D5 | Transparency | x-013 launch thread · x-014 spot a fake · **x-015 launch date (T-24h)** | tg-006 launch date |
| D6 | Launch | x-016 T-3h, then the launch sequence below | tg-007 … |

Minimum honest version if waiting a week is too long: 48 hours (D1 brand + site, D2 community + transparency + launch date, D3 launch).

## Launch day, minute by minute

| When | Who | What |
|---|---|---|
| T-60m | owner | Dashboard open (`npm run dashboard`), all tiles green except TOKEN/CA. SOL in the pump.fun wallet. Posts T+5…T+30 open in the dashboard. |
| T-15m | owner | Open pump.fun/create. Fill the form with the values below. **Stop before the final confirm.** |
| **T+0** | owner | Confirm creation (+ creator buy if chosen). Copy the CA from **your** coin page. |
| T+0 | dashboard | UPDATE CA → Verify (on-chain: mint, symbol CHEK, authorities, creation tx) → Publish → commit + build + deploy. Wait for "✓ DONE". |
| T+0 | owner | X bio → live bio (dashboard copies it). Telegram: post + pin **tg-007** in the channel and the chat. |
| T+0 | owner | Dashboard tiles: WEBSITE shows the CA, TELEGRAM pin done. Three places, one CA. |
| T+5m | owner | x-017 "receipt printing… 5 minutes." |
| T+10m | owner | **x-018 main launch post** (pin it on X) + tg-008. |
| T+30m | owner | x-019 transparency thread + tg-009 (real values from the dashboard). |
| T+60m | owner | x-020 meme. |
| T+2h | owner | x-021 what's live. |
| T+6h | owner | x-022 + tg-010 Receipt of the Week opens → mark it LIVE on the site + build-log line. |
| T+24h | owner | x-023 + tg-011 honest recap — real numbers only, no price talk. |

No countdown hype, no "price is going up", no charts.

## Pump.fun form (copy-paste)

- **Name:** `CHEK`
- **Ticker:** `CHEK`
- **Description:**

  ```
  CHEK is a meme coin with one rule: every claim comes with a receipt.

  Chek is a slip of thermal paper that only prints what it can prove. No presale, no team mint, no promises — memes, lore and proof.

  Official CA, creator wallet and the full build log: chekcoin.vercel.app
  We never DM first.
  ```

- **Image:** `brand/social/token-1000.png`
- **Banner:** `brand/social/x-header-1500x500.png`
- **Website:** `https://chekcoin.vercel.app`
- **X:** `https://x.com/chekcoin`
- **Telegram:** `https://t.me/chekcoin`
- **Pair:** SOL · **Creator rewards to:** Creator · **Mayhem mode:** OFF
- **Buy during creation:** owner's choice (published on the site either way)

Before pressing create: open pump.fun only by typing `pump.fun` yourself (no links from DMs or search ads), re-check fees on `pump.fun/docs/fees`, and read every field once more — none of them can be edited afterwards.

## After launch: content mix

40% memes/lore · 25% community · 15% build updates · 10% transparency · 10% token info. Never BUY BUY BUY.
