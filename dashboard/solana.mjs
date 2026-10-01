// Read-only Solana checks for a mint address (public RPC + pump.fun public API). No keys, no signing.
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(s) {
  let bytes = [0];
  for (const c of s) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const c of s) {
    if (c !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

export function isPubkey(s) {
  return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && base58Decode(s)?.length === 32;
}

async function rpc(method, params) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    const j = await res.json();
    if (j.error) throw new Error(`${method}: ${j.error.message}`);
    return j.result;
  }
  throw new Error(`${method}: rate-limited by RPC`);
}

const fmt = (n) => Number(n).toLocaleString("en-US");

// Full report used by the dashboard before the CA is published anywhere.
export async function inspectMint(ca, expect) {
  const checks = [];
  const add = (ok, label, detail, critical = true) => checks.push({ ok, label, detail, critical });
  const facts = { ca };

  add(isPubkey(ca), "Valid Solana address", isPubkey(ca) ? "base58, 32 bytes" : "not a valid public key");
  if (!isPubkey(ca)) return { ok: false, checks, facts };

  const acc = await rpc("getAccountInfo", [ca, { encoding: "jsonParsed", commitment: "confirmed" }]);
  if (!acc?.value) {
    add(false, "Account exists on mainnet", "not found — wrong address, or not on-chain yet (a pump.fun coin appears on-chain with its first buy)");
    return { ok: false, checks, facts };
  }
  const owner = acc.value.owner;
  const info = acc.value.data?.parsed?.info ?? {};
  const isMint = acc.value.data?.parsed?.type === "mint";
  add(isMint && (owner === TOKEN_2022 || owner === TOKEN), "Is a token mint", `${isMint ? "mint" : acc.value.data?.parsed?.type ?? "not a mint"} · ${owner === TOKEN_2022 ? "Token-2022" : owner === TOKEN ? "SPL Token" : owner}`);
  if (!isMint) return { ok: false, checks, facts };

  const meta = (info.extensions || []).find((e) => e.extension === "tokenMetadata")?.state;
  facts.name = meta?.name ?? null;
  facts.symbol = meta?.symbol ?? null;
  facts.decimals = info.decimals;
  facts.tokenProgram = owner === TOKEN_2022 ? "Token-2022" : "SPL Token";
  const supply = BigInt(info.supply) / 10n ** BigInt(info.decimals);
  facts.totalSupply = fmt(supply);
  facts.mintAuthority = info.mintAuthority ?? "disabled";
  facts.freezeAuthority = info.freezeAuthority ?? "disabled";

  add(facts.symbol?.toUpperCase() === expect.ticker.toUpperCase(), `Ticker is ${expect.ticker}`, `on-chain symbol: ${facts.symbol ?? "unknown (no metadata extension)"}`);
  add(facts.name?.trim().toUpperCase() === expect.name.toUpperCase(), `Name is ${expect.name}`, `on-chain name: ${facts.name ?? "unknown"}`, false);
  add(!info.mintAuthority, "Mint authority disabled", info.mintAuthority ? `still set: ${info.mintAuthority}` : "nobody can mint more");
  add(!info.freezeAuthority, "Freeze authority disabled", info.freezeAuthority ? `still set: ${info.freezeAuthority}` : "nobody can freeze wallets");
  add(ca.endsWith("pump"), "Pump.fun vanity suffix", ca.endsWith("pump") ? "address ends with …pump" : "UI-created pump.fun coins end with 'pump'", false);

  // Oldest signature = creation transaction.
  let before;
  let oldest;
  for (let page = 0; page < 20; page++) {
    const sigs = await rpc("getSignaturesForAddress", [ca, { limit: 1000, ...(before ? { before } : {}) }]);
    if (!sigs.length) break;
    oldest = sigs.at(-1);
    if (sigs.length < 1000) break;
    before = oldest.signature;
  }
  if (oldest) {
    const tx = await rpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    const keys = tx?.transaction?.message?.accountKeys ?? [];
    const payer = keys.find((k) => k.signer)?.pubkey ?? keys[0]?.pubkey;
    facts.createdAt = tx?.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null;
    facts.creationTx = oldest.signature;
    // real cost, published after the mint: network fee, and everything the creator wallet spent in that tx (buy + rent + fees)
    facts.creationFeeSol = tx?.meta ? (tx.meta.fee / 1e9).toFixed(6) : null;
    const pi = keys.findIndex((k) => k.pubkey === payer);
    facts.creationSolSpent = tx?.meta && pi >= 0 ? ((tx.meta.preBalances[pi] - tx.meta.postBalances[pi]) / 1e9).toFixed(6) : null;
    facts.creatorWallet = payer ?? null;
    const bought = (tx?.meta?.postTokenBalances ?? []).find((b) => b.mint === ca && b.owner === payer);
    if (bought && Number(bought.uiTokenAmount.uiAmount) > 0) {
      const pct = (Number(bought.uiTokenAmount.uiAmount) / Number(supply)) * 100;
      facts.creatorBuy = `${fmt(Math.round(bought.uiTokenAmount.uiAmount))} ${expect.ticker} (${pct.toFixed(2)}% of supply) in the creation tx`;
    } else facts.creatorBuy = "none in the creation tx";
    add(Boolean(facts.createdAt), "Creation transaction found", `${oldest.signature.slice(0, 10)}… · ${facts.createdAt ?? "?"}`);
  } else add(false, "Creation transaction found", "no signatures yet", false);

  // Cross-check with pump.fun's public (unofficial) API — informational.
  try {
    const r = await fetch(`https://frontend-api-v3.pump.fun/coins-v2/${ca}`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const c = await r.json();
      facts.pump = { name: c.name, symbol: c.symbol, creator: c.creator, created: c.created_timestamp ? new Date(c.created_timestamp).toISOString() : null, website: c.website ?? null, twitter: c.twitter ?? null, telegram: c.telegram ?? null };
      add(c.symbol?.toUpperCase() === expect.ticker.toUpperCase(), "Pump.fun lists this coin", `${c.name} ($${c.symbol}) · creator ${c.creator?.slice(0, 6)}…`, false);
      if (facts.creatorWallet && c.creator) add(c.creator === facts.creatorWallet, "Creator matches pump.fun", c.creator === facts.creatorWallet ? "same wallet" : `pump.fun says ${c.creator}`, false);
      if (expect.website) add((c.website || "").replace(/\/$/, "") === expect.website.replace(/\/$/, ""), "Coin links to our website", c.website || "no website set on the coin", false);
    } else add(false, "Pump.fun lists this coin", `pump.fun API answered ${r.status}`, false);
  } catch (e) {
    add(false, "Pump.fun lists this coin", `pump.fun API not reachable from this PC (${e.name})`, false);
  }

  const ok = checks.filter((c) => c.critical).every((c) => c.ok);
  return { ok, checks, facts };
}
