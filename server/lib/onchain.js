// ON-CHAIN AGENT: watches public Solana activity of the project's own wallets and turns significant events into
// ON-CHAIN VERIFIED receipts (always with the transaction). Importance thresholds prevent spam.
import { alert, audit, getSetting, setSetting } from "./core.js";
import { enqueue } from "./queue.js";
import { createReceipt, receiptLabel } from "./receipts.js";
import { officialCa, project, withLiveToken } from "./project.js";
import { b58decode, findPda, rpc } from "./solana.js";

export const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const CLAIM_LOG = /Instruction: (CollectCreatorFee(?:V2)?|CollectCoinCreatorFee|DistributeCreatorFees(?:V2)?)/;
const RENT_EMPTY = 650_240; // rent-exempt minimum of a 0-byte account (lamports), as checked 2026-10-02

export const creatorVault = (creator) => findPda(["creator-vault", b58decode(creator)], PUMP_PROGRAM)[0];

async function tokenBalance(owner, mint) {
  const r = await rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
}

// Live creator position for the site (cached by the API layer).
export async function creatorPosition() {
  const p = withLiveToken(project(), await getSetting("token_live"));
  const ca = officialCa(p);
  const wallet = p.token.creatorWallet;
  if (!ca || !wallet) return { live: false };
  const [holding, supplyRes, vaultLamports] = await Promise.all([
    tokenBalance(wallet, ca),
    rpc("getTokenSupply", [ca]),
    rpc("getBalance", [creatorVault(wallet)]).then((r) => r.value).catch(() => null),
  ]);
  const supply = Number(supplyRes.value.uiAmount);
  return {
    live: true,
    wallet,
    holding,
    pct: supply ? (holding / supply) * 100 : null,
    supply,
    initialBuy: p.token.creatorBuy,
    creationTx: p.token.creationTx,
    unclaimedCreatorFeesSol: vaultLamports === null ? null : Math.max(0, vaultLamports - RENT_EMPTY) / 1e9,
    readAt: new Date().toISOString(),
  };
}

// Classify one transaction of the creator wallet.
function classify(tx, wallet, ca, supply) {
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  const wi = keys.indexOf(wallet);
  const solDelta = wi >= 0 ? (tx.meta.postBalances[wi] - tx.meta.preBalances[wi]) / 1e9 : 0;
  const bal = (list) => list.filter((b) => b.mint === ca && b.owner === wallet).reduce((s, b) => s + Number(b.uiTokenAmount.uiAmount || 0), 0);
  const tokenDelta = bal(tx.meta.postTokenBalances || []) - bal(tx.meta.preTokenBalances || []);
  const logs = (tx.meta.logMessages || []).join("\n");
  const claim = CLAIM_LOG.exec(logs)?.[1] ?? null;
  return { solDelta, tokenDelta, claim, pctMove: supply ? (Math.abs(tokenDelta) / supply) * 100 : 0 };
}

export async function runWatcher() {
  const p = withLiveToken(project(), await getSetting("token_live"));
  const ca = officialCa(p);
  const wallet = p.token.creatorWallet;
  if (!ca || !wallet) {
    await audit("onchain", "watch.skip", "skip", { detail: { reason: "no official CA yet" } });
    return { skipped: "no CA" };
  }
  const cursors = (await getSetting("onchain_cursors")) || {};
  const sigs = await rpc("getSignaturesForAddress", [wallet, { limit: 100, ...(cursors.creator ? { until: cursors.creator } : {}) }]);
  if (!sigs.length) return { new: 0 };
  const supply = Number((await rpc("getTokenSupply", [ca])).value.uiAmount);
  const thresholdPct = (await getSetting("onchain_threshold_pct")) ?? 0.01; // ≥ 0.01% of supply moved = significant
  let made = 0;

  for (const s of [...sigs].reverse()) {
    if (s.err) continue;
    const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    if (!tx) continue;
    const c = classify(tx, wallet, ca, supply);
    const when = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : new Date().toISOString();
    let r = null;
    if (c.claim && c.solDelta > 0) {
      r = { kind: "fees", title: "CREATOR FEES CLAIMED", status: "CLAIMED", amount: c.solDelta, currency: "SOL" };
    } else if (c.pctMove >= thresholdPct && c.tokenDelta !== 0) {
      const sold = c.tokenDelta < 0;
      r = {
        kind: "creator",
        title: `CREATOR ${sold ? (c.solDelta > 0 ? "SOLD" : "MOVED") : c.solDelta < 0 ? "BOUGHT" : "RECEIVED"} ${p.ticker}`,
        status: sold ? (c.solDelta > 0 ? "SOLD" : "MOVED") : "BOUGHT",
        amount: Math.abs(c.tokenDelta),
        currency: p.ticker,
      };
    }
    if (r) {
      const { receipt, created } = await createReceipt({ ...r, verification: "onchain", tx: s.signature, occurredAt: when, dedupeKey: `tx:${s.signature}`, data: { solDelta: c.solDelta, pctOfSupply: c.pctMove } }, "onchain");
      if (created) {
        made++;
        // Creator position changes are always disclosed, immediately, on both channels.
        for (const platform of ["telegram", "x"]) {
          await enqueue({
            id: `rcpt-${receipt.number}-${platform}`,
            platform,
            category: "transparency",
            level: "auto",
            origin: "onchain",
            receiptId: receipt.id,
            payload: {
              parts: [`${receiptLabel(receipt)} · ${receipt.title}\n${r.currency === "SOL" ? `${r.amount.toFixed(4)} SOL` : `${Math.round(r.amount).toLocaleString("en-US")} ${r.currency} (${c.pctMove.toFixed(2)}% of supply)`}\nON-CHAIN VERIFIED\nsolscan.io/tx/${s.signature}`],
              imageUrl: `/api/image?receipt=${receipt.number}`,
            },
          });
        }
      }
    }
  }
  cursors.creator = sigs[0].signature;
  await setSetting("onchain_cursors", cursors);
  await audit("onchain", "watch.creator", "ok", { detail: { txs: sigs.length, receipts: made } });
  if (made > 5) await alert("warn", "onchain_burst", `${made} creator-wallet receipts in one run — check activity`);
  return { new: sigs.length, receipts: made };
}
