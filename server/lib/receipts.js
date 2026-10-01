// RECEIPT ENGINE: every significant project action becomes a numbered receipt (data first; images and posts are derived).
import { audit, bump } from "./core.js";
import { db } from "./db.js";
import { history } from "./project.js";

const pad = (n) => `#${String(n).padStart(4, "0")}`;
export const receiptLabel = (r) => pad(r.number);

export async function createReceipt(r, agent = "receipt") {
  const sql = await db();
  if (r.verification === "onchain" && !r.tx) throw new Error("on-chain receipt needs a transaction");
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(734100043)`;
    if (r.dedupeKey) {
      const [dup] = await tx`select * from chek.receipts where dedupe_key = ${r.dedupeKey}`;
      if (dup) return { receipt: dup, created: false };
    }
    const [{ next }] = await tx`select coalesce(max(number), 0) + 1 as next from chek.receipts`;
    const [row] = await tx`insert into chek.receipts
      (number, kind, title, status, verification, amount, currency, tx, proof_url, proof_label, occurred_at, source, dedupe_key, data)
      values (${next}, ${r.kind}, ${r.title.slice(0, 120)}, ${r.status}, ${r.verification}, ${r.amount ?? null}, ${r.currency ?? null},
        ${r.tx ?? null}, ${r.proofUrl ?? null}, ${r.proofLabel ?? null}, ${r.occurredAt ?? new Date().toISOString()}, ${agent},
        ${r.dedupeKey ?? null}, ${tx.json(r.data ?? {})})
      returning *`;
    return { receipt: row, created: true };
  }).then(async (res) => {
    if (res.created) {
      await audit(agent, "receipt.created", "ok", { ref: pad(res.receipt.number), detail: { title: res.receipt.title, verification: res.receipt.verification } });
      await bump("receipts_created");
    }
    return res;
  });
}

export async function listReceipts({ limit = 100, kind = null } = {}) {
  const sql = await db();
  return kind
    ? sql`select * from chek.receipts where kind = ${kind} order by number desc limit ${limit}`
    : sql`select * from chek.receipts order by number desc limit ${limit}`;
}

// Build-log entries (content/history.json) become reported receipts once, in chronological order.
export async function syncBuildLog() {
  let created = 0;
  for (const e of history().entries) {
    const commit = e.proof?.label?.match(/commit ([0-9a-f]{7,40})/)?.[1];
    const { created: c } = await createReceipt(
      {
        kind: /token created/i.test(e.title) ? "launch" : "build",
        title: e.title,
        status: /token created/i.test(e.title) ? "LOGGED" : "SHIPPED",
        verification: "reported",
        proofLabel: e.proof?.label ?? null,
        proofUrl: e.proof?.href ?? null,
        occurredAt: e.date,
        dedupeKey: `buildlog:${e.date}:${e.title}`,
        data: { detail: e.detail ?? null, commit: commit ?? null, correction: e.correction ?? null },
      },
      "site",
    );
    if (c) created++;
  }
  return created;
}

export function publicReceipt(r) {
  return {
    number: r.number,
    label: pad(r.number),
    kind: r.kind,
    title: r.title,
    status: r.status,
    verification: r.verification === "onchain" ? "ON-CHAIN VERIFIED" : "PROJECT REPORTED",
    amount: r.amount === null ? null : Number(r.amount),
    currency: r.currency,
    tx: r.tx,
    txUrl: r.tx ? `https://solscan.io/tx/${r.tx}` : null,
    proofUrl: r.proof_url,
    proofLabel: r.proof_label,
    occurredAt: r.occurred_at,
    detail: r.data?.detail ?? null,
  };
}
