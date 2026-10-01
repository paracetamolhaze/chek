# Growth — how people discover and share CHEK

Goal: community discovery, not price. No bought followers, likes or engagement farms, no paid shill groups presented as organic, no automated likes/follows/keyword replies (X automation rules, as checked 2026-10-01).

## The loop

```
someone sees a CHEK receipt (on X, in Telegram, in a chat)
  → opens it (share card /r → /print, or the bot)
  → prints their own receipt for a claim they heard (no wallet, no sign-up)
  → shares it (one click: Share on X, with “via @chekcoinsol”; or forwards the bot's image)
  → their followers see a CHEK receipt …
```

Every generated image carries subtle branding — **CHEK · @chekcoinsol** and the site — and the line “printed by a visitor · not a statement by CHEK”. Official receipts (ON-CHAIN VERIFIED / PROJECT REPORTED) look different and can never be printed by visitors.

## Surfaces

| Surface | What it does | Status |
|---|---|---|
| `/print` | Write a claim → receipt preview → Share on X / Download / Copy link | live |
| `/r?c=…` | Share card for X (large image of the receipt) → sends people to `/print` with that receipt | live |
| @chekcoinsol_bot | Send any claim → get the receipt image + Share on X; optionally offer it for the channel (credit or anonymous) | live after webhook setup |
| X mentions | “@chekcoinsol receipt: <claim>” → reply with the receipt image, owner-approved, one reply per mention | needs X connection |
| Receipt of the Week | Weekly format: people print and tag us; the best one gets into the lore (no money prizes) | after launch |

## Native content (most posts have no link)

- Receipts for widely-heard claims (“trust me bro”, “partnership soon”) — generic, never naming people.
- Lore: Chek, The Shredder, The Coupon, Register #4.
- Build receipts (real commits, real numbers).
- Short shitposts and polls.
- Real crypto/Solana/meme events only through the news desk (verbatim source quotes, sources stored).
- The token is the subject of at most one post in three.

## What we measure (to improve the format — never published as social proof)

Impressions, profile visits, follows, site visits from X/Telegram (anonymous counter), Telegram channel size, receipts printed (site + bot), receipts shared, downloads, community submissions. X numbers come from the official API once connected.
