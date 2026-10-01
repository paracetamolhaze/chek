// INITIAL BUY CALCULATOR — reads live Pump.fun parameters from Solana (nothing hard-coded), live SOL price,
// and reproduces the program's integer math for buy_exact_sol_in on a fresh bonding curve.
// Sources: pump-fun/pump-public-docs IDLs (pump.json Global, pump_fees.json FeeConfig), checked 2026-10-02.
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const GLOBAL = "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"; // pump PDA ["global"]
const FEE_CONFIG = "8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt"; // pump_fees PDA ["fee_config", pump program]
const LAMPORTS = 1_000_000_000n;

async function account(address) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [address, { encoding: "base64" }] }) });
  const j = await r.json();
  if (!j.result?.value) throw new Error(`account ${address} not found`);
  return Buffer.from(j.result.value.data[0], "base64");
}

const u64 = (b, o) => b.readBigUInt64LE(o);
const u128 = (b, o) => b.readBigUInt64LE(o) + (b.readBigUInt64LE(o + 8) << 64n);

// Global: disc(8) initialized(1) authority(32) fee_recipient(32) ivtr ivsr irtr supply fee_bps (u64 each) …
export function decodeGlobal(b) {
  return {
    initialVirtualTokenReserves: u64(b, 73),
    initialVirtualSolReserves: u64(b, 81),
    initialRealTokenReserves: u64(b, 89),
    tokenTotalSupply: u64(b, 97),
    feeBps: u64(b, 105),
    creatorFeeBpsFallback: u64(b, 154),
  };
}

// FeeConfig: disc(8) bump(1) admin(32) flat_fees(3×u64) fee_tiers: vec<{u128 threshold, Fees}> …
export function decodeFeeTiers(b) {
  let o = 8 + 1 + 32 + 24;
  const n = b.readUInt32LE(o);
  o += 4;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push({ threshold: u128(b, o), lp: u64(b, o + 16), protocol: u64(b, o + 24), creator: u64(b, o + 32) });
    o += 40;
  }
  return tiers;
}

async function solPrice() {
  const sources = [
    ["Binance", "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", (j) => Number(j.price)],
    ["Kraken", "https://api.kraken.com/0/public/Ticker?pair=SOLUSD", (j) => Number(Object.values(j.result)[0].c[0])],
    ["CoinGecko", "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", (j) => Number(j.solana.usd)],
  ];
  const got = [];
  await Promise.all(
    sources.map(async ([name, url, pick]) => {
      try {
        const v = pick(await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json());
        if (v > 0) got.push({ name, usd: v });
      } catch {}
    }),
  );
  if (!got.length) throw new Error("no SOL price source reachable");
  const sorted = got.map((g) => g.usd).sort((a, b) => a - b);
  return { usd: sorted[Math.floor(sorted.length / 2)], sources: got, at: new Date().toISOString() };
}

const ceilDiv = (a, b) => (a + b - 1n) / b;

// Program math for buy_exact_sol_in on a FRESH curve (no trades before the creator's buy).
export function quote(spendLamports, g, fees) {
  const total = fees.protocol + fees.creator;
  const vT = g.initialVirtualTokenReserves;
  const vS = g.initialVirtualSolReserves;
  let net = (spendLamports * 10000n) / (10000n + total);
  let feeLamports = ceilDiv(net * fees.protocol, 10000n) + ceilDiv(net * fees.creator, 10000n);
  if (net + feeLamports > spendLamports) net -= net + feeLamports - spendLamports;
  feeLamports = ceilDiv(net * fees.protocol, 10000n) + ceilDiv(net * fees.creator, 10000n);
  let tokens = ((net - 1n) * vT) / (vS + net - 1n);
  if (tokens > g.initialRealTokenReserves) tokens = g.initialRealTokenReserves;
  const spot0 = Number(vS) / Number(vT); // lamports per raw token unit
  const avg = Number(net) / Number(tokens);
  const vS1 = Number(vS + net);
  const vT1 = Number(vT - tokens);
  return {
    tokensRaw: tokens,
    tokens: Number(tokens) / 1e6,
    pctSupply: (Number(tokens) / Number(g.tokenTotalSupply)) * 100,
    tradeFeeSol: Number(feeLamports) / 1e9,
    creatorFeeSol: Number(ceilDiv(net * fees.creator, 10000n)) / 1e9,
    avgPremiumPct: (avg / spot0 - 1) * 100,
    priceMovePct: (vS1 / vT1 / spot0 - 1) * 100,
  };
}

/** Full calculator table for USD amounts. */
export async function calculator(usdAmounts = [50, 100, 150, 200, 250, 500]) {
  const [gb, fb, price] = await Promise.all([account(GLOBAL), account(FEE_CONFIG), solPrice()]);
  const g = decodeGlobal(gb);
  const tiers = decodeFeeTiers(fb);
  // fresh-curve market cap (lamports) → tier with the highest threshold ≤ mcap
  const mcap = (g.initialVirtualSolReserves * g.tokenTotalSupply) / g.initialVirtualTokenReserves;
  const tier = tiers.filter((t) => t.threshold <= mcap).sort((a, b) => (a.threshold > b.threshold ? -1 : 1))[0] || { protocol: g.feeBps, creator: g.creatorFeeBpsFallback, lp: 0n };
  const networkEstimateSol = [0.006, 0.012]; // rent + priority fee, measured on recent create+buy txs (estimate, not a promise)
  const rows = usdAmounts.map((usd) => {
    const sol = usd / price.usd;
    const q = quote(BigInt(Math.floor(sol * 1e9)), g, tier);
    return { usd, sol, ...q, tokensRaw: undefined, estFeesSol: [q.tradeFeeSol + networkEstimateSol[0], q.tradeFeeSol + networkEstimateSol[1]] };
  });
  return {
    checkedAt: new Date().toISOString(),
    solUsd: price,
    params: {
      supply: Number(g.tokenTotalSupply) / 1e6,
      virtualSol: Number(g.initialVirtualSolReserves) / 1e9,
      virtualTokens: Number(g.initialVirtualTokenReserves) / 1e6,
      realTokens: Number(g.initialRealTokenReserves) / 1e6,
      feeBps: { protocol: Number(tier.protocol), creator: Number(tier.creator), lp: Number(tier.lp ?? 0n) },
      startMarketCapSol: Number(mcap) / 1e9,
    },
    networkEstimateSol,
    rows,
    notes: [
      "Fresh-curve math: valid only if the creator's buy is the first trade (buy during creation).",
      "Trade fee = protocol + creator share; the creator share goes to the creator's own fee vault.",
      "Network/rent is an estimate from recent transactions; the real cost is read from the creation tx after the mint.",
      "Mayhem mode or custom pairs change the curve — keep Mayhem OFF and pair SOL.",
    ],
  };
}

export async function walletBalanceSol(address) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }) });
  const j = await r.json();
  return j.result ? Number(BigInt(j.result.value) * 1000n / LAMPORTS) / 1000 : null;
}
