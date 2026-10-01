# Tokenomics (draft until launch)

**Final token data will be published at launch.** Nothing below about *our* coin is filled in until it exists on-chain. The dashboard reads the real values from Solana and writes them into `config/project.json`; the website shows only those.

## What we commit to

| Item | Value |
|---|---|
| Network | Solana |
| Ticker | $CHEK |
| Launch platform | Pump.fun (fair launch on a bonding curve) |
| Presale / whitelist / private round | **None** |
| Team mint / team allocation | **None** |
| Treasury wallet | None |
| Other allocations | None |
| Token tax | None |
| Creator buy at launch | Published at launch: amount, % of supply, transaction link |
| Creator wallet | Published at launch |

## What a standard Pump.fun coin looks like today

As checked 2026-10-01 against Pump.fun docs and fresh mints on mainnet (see `docs/pumpfun.md`). This is the *expected* shape, not a claim about our coin:

- Total supply 1,000,000,000, 6 decimals, Token-2022 program.
- Mint authority: none. Freeze authority: none. Metadata update authority: none (name, ticker and image can't change).
- 793.1M tokens (79.31%) are sold on the bonding curve; 206.9M (20.69%) are kept for the liquidity pool at graduation.
- Graduation when the curve is sold out (~85 SOL in the curve) → the coin migrates to PumpSwap and the LP tokens are burned.

## Fees (set by Pump.fun, not by us — as checked 2026-10-01, re-checked on launch day)

- Bonding curve: 1.25% per trade — 0.95% protocol, **0.30% to the coin creator**.
- After graduation (PumpSwap): tiered by market cap; the creator share starts at 0.30% and changes by tier.
- We disclose the creator fee because it is real income for the creator wallet. Pump.fun offers a "send creator rewards to holders" option; we don't use it, because it would look like a yield promise — and we don't make those.

## What will never happen

- No hidden wallets, no "marketing allocation", no "team unlock schedule".
- No promised buybacks or burns. If anything like that ever happens, it gets announced with a transaction link.
