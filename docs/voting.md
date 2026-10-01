# Voting design (phase 4 — proposal)

Polls decide fun things: the next meme, a lore twist, a new character, a site feature. They never decide money, ownership or anything legal. That lowers the stakes — and shapes the choice.

## Options compared

| Model | Plutocracy | Sybil resistance (one person, many wallets) | Fits CHEK? |
|---|---|---|---|
| One wallet = one vote | none | **weak** — splitting into wallets multiplies votes | yes, for low-stakes polls, with friction (below) |
| Token-weighted (linear) | **strong** — the biggest wallet decides | neutral — splitting changes nothing | no — turns memes into whale votes |
| Capped token-weighted (`min(balance, cap)`) | limited for honest whales | weak above the cap — a whale just splits into capped wallets | not much better than linear |
| Square-root / quadratic | softened | **worse** — splitting *increases* total weight | no |

No model is both fair and sybil-proof without identity. So we don't pretend one is.

## Recommendation

1. **One verified holder = one vote**, with friction against wallet farms:
   - minimum holding to vote (e.g. 0.001% of supply), checked at a **snapshot taken when the poll opens** — buying after it opens doesn't count;
   - the wallet must have held at least that amount for **24 h before the snapshot**;
   - creator and project wallets **cannot vote**.
2. **Publish two tallies side by side**: wallets and token-weighted. If they disagree, everyone sees it. Receipts, not trust.
3. **Every vote is a signed message** (Proof of Hold signature: plain text, no transaction). All signed votes are published so anyone can recount.
4. Results become a receipt on the Receipt Board.

## Not doing

No on-chain governance, no binding votes on treasury or token matters, no promises that votes control anything beyond the listed fun decisions.
