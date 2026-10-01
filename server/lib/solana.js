// Minimal Solana helpers (read-only): base58, PDA derivation, JSON-RPC, signature verification.
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { env } from "./env.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function b58decode(s) {
  let bytes = [0];
  for (const c of s) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) throw new Error("bad base58");
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

export function b58encode(bytes) {
  const digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const b of bytes) {
    if (b !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}

export const isPubkey = (s) => {
  try {
    return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && b58decode(s).length === 32;
  } catch {
    return false;
  }
};

const onCurve = (bytes) => {
  try {
    ed25519.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
};

// Program-derived address (same algorithm as PublicKey.findProgramAddressSync).
export function findPda(seeds, programId) {
  const program = b58decode(programId);
  const marker = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds.map((s) => (typeof s === "string" ? new TextEncoder().encode(s) : s)), Uint8Array.of(bump), program, marker];
    const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      buf.set(p, o);
      o += p.length;
    }
    const hash = sha256(buf);
    if (!onCurve(hash)) return [b58encode(hash), bump];
  }
  throw new Error("no PDA");
}

export async function rpc(method, params) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(env.solanaRpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(15_000) });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      continue;
    }
    const j = await res.json();
    if (j.error) throw new Error(`${method}: ${j.error.message}`);
    return j.result;
  }
  throw new Error(`${method}: rate-limited`);
}

// ed25519 signature check for "Sign in with wallet" (holder verification, later phases).
export function verifySignature(message, signatureB58, pubkeyB58) {
  try {
    return ed25519.verify(b58decode(signatureB58), new TextEncoder().encode(message), b58decode(pubkeyB58));
  } catch {
    return false;
  }
}
