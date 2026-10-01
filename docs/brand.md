# Brand system — CHEK ($CHEK)

The design comes from one object: a thermal-paper receipt. If a choice doesn't come from a receipt, a register, a stamp or a highlighter, it doesn't belong.

## Name

| | |
|---|---|
| Name | **CHEK** (wordmark always caps) |
| Ticker | **$CHEK** — 4 letters, a clickable cashtag on X |
| Mascot | **Chek** — a slip of thermal paper that only prints what it can prove |
| Tagline | **Receipts or it didn't happen.** |
| One-liner | $CHEK is a meme coin on Solana with one rule: every claim comes with a receipt. |
| Handle | `chekcoin` everywhere (X, Telegram, Vercel) |

Never write "$CHECK" (that's a different coin) — always **$CHEK**.

## Character

- **Chek** — deadpan, pedantic, honest to a fault. Signature look: one eyebrow up ("receipt?"). Can't lie: it's a receipt.
- Moods: skeptic (default), neutral, happy ("verified"), shock ("you bought WHAT?"), angry + stamp ("VOID"), magnifier ("checking the CA"), wink/wave ("gm"), sleep ("printing since 03:14").
- **Register #4** — the closed corner-store register that printed Chek at 03:14 AM.
- **The Shredder** (villain) — eats evidence: deleted posts, wiped sites, vanished devs. Leaves confetti.
- **The Coupon** (villain) — loud, shiny, always expiring: "100X OFF! TODAY ONLY!". Fine print: none of it is real.
- Villains are scam archetypes, so lore doubles as anti-scam education.

Source of every drawing: `brand/mascot.mjs` (SVG generated in code). Change the mascot there and re-render everything:

```bash
npm run assets                      # icons, avatars, X header, token image, OG, kit
node scripts/render-content.mjs     # post images (mascot + memes)
node scripts/render-gif.mjs         # reaction GIF/MP4 (needs ffmpeg)
```

## Colors

| Token | Hex | Use |
|---|---|---|
| Thermal paper | `#F4F0E6` | receipts, cards, light text on dark |
| Paper back | `#E6DFCF` | curl of the roll, shading |
| Thermal ink | `#1B1A17` | text, outlines, the mascot's face |
| Counter | `#141311` | page background (the shop counter) |
| Faded ink | `#6B665C` | secondary text (old thermal print) |
| Stamp red | `#D8332A` | stamps only: VOID, NOT LAUNCHED YET, warnings |
| Highlighter | `#F6E05E` | one highlight per screen, avatars/token background |

No gradients, no glass, no glowing orbs. Depth comes from paper shadow and hard 4px offset shadows ("printed" buttons).

## Type

- **Doto** (SIL OFL) — dot-matrix display face: the wordmark, big numbers, section numbers. It's what a receipt printer would print.
- **Martian Mono** (SIL OFL, variable width) — everything else. Expanded (112.5%) for headlines, condensed (87.5%) for body.
- Files: `brand/fonts/` (self-hosted on the site; no Google requests).

## Receipt UI language

- Dashed rules `- - - -`, double rules for totals, `* * * * *` separators.
- Dot leaders: `LABEL ........ VALUE` for any fact.
- Zig-zag torn edges (CSS masks) on every paper surface.
- Rubber stamps (rotated, red, slightly worn texture) for status.
- Highlighter behind the one phrase that matters.
- Code 128 barcodes that really scan.
- Status tags: `LIVE` (ink), `NOW` (highlighter), `PLANNED` (outline), `LATER` (dashed).

## Icons

UI icons: 1.75px monoline, square caps, 24px grid (`website/src/components/icons.tsx`). Brand logos for X, Telegram, GitHub are filled. The logo mark (receipt + skeptical face) is the favicon and app icon on a highlighter tile.

## Assets

| File | Size | Where |
|---|---|---|
| `brand/social/x-avatar-400.png` | 400×400 | X avatar |
| `brand/social/x-header-1500x500.png` | 1500×500 | X header, Pump.fun banner |
| `brand/social/telegram-avatar-640.png` | 640×640 | Telegram channel + chat |
| `brand/social/token-1000.png` | 1000×1000 | Pump.fun token image (min 1000×1000, 1:1) |
| `website/src/app/opengraph-image.png` | 1200×630 | link previews |
| `website/src/app/favicon.ico`, `icon.svg`, `apple-icon.png` | 16–180 | browser icons |
| `website/public/kit/*` | 800×1200 | meme kit: 8 poses, 2 villains, logo, wordmarks |
| `content/mascot/*`, `content/memes/*` | 1080×1080 | posts |
| `content/animations/receipt-reaction.{gif,mp4}` | 600×600 | reply GIF |

The avatar and the token image are the same picture on purpose: people can match them at a glance.

## Voice

Short. Lowercase on X, sentence case on the site. Deadpan, a bit pedantic, never hype.

- ✅ "receipts or it didn't happen." · "no CA exists yet. anything you see is fake." · "telling you because it's real money and you should know."
- ❌ "🚀🚀 100x gem" · "LFG" · "don't miss out" · "partnership soon" · anything about price going up.

Every claim gets a link. If there's no link, it doesn't get posted.
