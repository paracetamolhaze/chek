// LAUNCH: the minute the owner's creation transaction is confirmed.
// Trigger: the PC launch watcher (dashboard) sees the create tx from the announced creator wallet and calls
// POST /api/admin {op:"launch", ca}. The owner can also paste the CA by hand. Either way the server re-verifies on-chain.
// Order (as close to simultaneous as is safe):
//   1. verify mint + creator transaction (independently, here)        → refuse anything that doesn't match
//   2. website: settings.token_live → /api/public?op=token flips the CA box within seconds (static rebuild follows from the PC)
//   3. X launch post (x-310)  4. Telegram launch message + pin (tg-310)
//   5. Transparency / Creator Receipt: on-chain receipts #launch and #creator; T+12m / T+40m posts are scheduled from the real minute
import { inspectMint } from "../../shared/solana-inspect.mjs";
import { alert, audit, getSetting, setSetting } from "./core.js";
import { db } from "./db.js";
import { AppError } from "./http.js";
import { project } from "./project.js";
import { runPublisher } from "./publisher.js";
import { reschedule } from "./queue.js";
import { createReceipt } from "./receipts.js";

const num = (s) => (s == null ? null : Number(String(s).replace(/[,%]/g, "")));

export async function confirmLaunch(ca, by = "owner") {
  const p = project();
  const already = await getSetting("token_live");
  if (already?.ca && already.ca !== ca) throw new AppError(409, `already launched with ${already.ca}`);
  const creatorWallet = (await getSetting("creator_wallet"))?.address || p.token.creatorWallet || null;

  // 1. independent on-chain verification
  const report = await inspectMint(ca, { ticker: p.ticker, name: p.name, website: p.links.website, creatorWallet });
  const failed = report.checks.filter((c) => c.critical && !c.ok);
  if (!report.ok || !creatorWallet) {
    await audit("launch", "launch.verify_failed", "error", { ref: ca, detail: { failed, creatorWallet } });
    await alert("error", "launch_verify", `Launch NOT confirmed for ${ca}: ${creatorWallet ? failed.map((c) => `${c.label} (${c.detail})`).join("; ") : "no announced creator wallet"}`);
    throw new AppError(409, creatorWallet ? `verification failed: ${failed.map((c) => c.label).join(", ")}` : "creator wallet not announced");
  }
  const f = report.facts;
  const live = {
    ca,
    createdAt: f.createdAt,
    totalSupply: f.totalSupply,
    decimals: f.decimals,
    tokenProgram: f.tokenProgram,
    mintAuthority: f.mintAuthority,
    freezeAuthority: f.freezeAuthority,
    creatorWallet: f.creatorWallet,
    creatorBuy: f.creatorBuy,
    creatorBuySol: f.creatorBuySol ?? null,
    creatorTokens: f.creatorTokens ?? null,
    creatorPct: f.creatorPct ?? null,
    creationTx: f.creationTx,
    creationFeeSol: f.creationFeeSol,
    creationSolSpent: f.creationSolSpent,
    verifiedAt: new Date().toISOString(),
    verifiedBy: by,
  };

  // 2. website (API) switches first
  await setSetting("token_live", live);
  await audit("launch", "launch.confirmed", "ok", { ref: ca, detail: live });

  // the real launch minute anchors every T+ post; leftover T- reminders are now wrong → skipped
  const schedule = await getSetting("schedule");
  await setSetting("schedule", { ...schedule, launchedAt: f.createdAt || live.verifiedAt });
  const sql = await db();
  await sql`update chek.queue set status = 'skipped', last_error = 'launched before this reminder', updated_at = now()
    where slot like 'T-%' and status in ('ready','review','approved')`;
  await reschedule();

  // receipts for the transparency page (both on-chain, with the creation tx)
  const at = f.createdAt || live.verifiedAt;
  const { receipt: launchR } = await createReceipt(
    { kind: "launch", title: `Token created on Pump.fun · ${p.name} ($${p.ticker})`, status: "STARTED", verification: "onchain", tx: f.creationTx, occurredAt: at, dedupeKey: `launch:${ca}`, data: { ca, mintAuthority: f.mintAuthority, freezeAuthority: f.freezeAuthority, supply: f.totalSupply } },
    "launch",
  );
  let creatorR = null;
  if (num(f.creatorBuySol)) {
    ({ receipt: creatorR } = await createReceipt(
      { kind: "creator", title: `Creator buy at creation · ${f.creatorTokens} ${p.ticker} (${f.creatorPct})`, status: "BOUGHT", verification: "onchain", tx: f.creationTx, amount: num(f.creatorBuySol), currency: "SOL", occurredAt: at, dedupeKey: `creator-buy:${ca}`, data: { wallet: f.creatorWallet, tokens: f.creatorTokens, pct: f.creatorPct } },
      "launch",
    ));
  }
  // the watcher starts after the creation tx (its buy is already receipted above)
  await setSetting("onchain_cursors", { ...((await getSetting("onchain_cursors")) || {}), creator: f.creationTx });
  const inputs = (await getSetting("inputs")) || {};
  await setSetting("inputs", { ...inputs, LAUNCH_RECEIPT_N: String(launchR.number), ...(creatorR ? { CREATOR_RECEIPT_N: String(creatorR.number) } : {}) });

  // 3 + 4. X first, then Telegram (each independent: a failure on one never blocks the other)
  const now = new Date();
  const x = await runPublisher(now, { ids: ["x-310"], platforms: ["x"] }).catch((e) => ({ error: e.message }));
  const tg = await runPublisher(now, { ids: ["tg-310"], platforms: ["telegram"] }).catch((e) => ({ error: e.message }));
  await audit("launch", "launch.announced", "ok", { ref: ca, detail: { x, tg } });
  return { ok: true, live, receipts: { launch: launchR.number, creator: creatorR?.number ?? null }, x, tg, checks: report.checks };
}

// What the PC agent's launch watcher needs: armed from T-2h (or when the owner arms it) until the mint is confirmed.
export async function launchWatch() {
  const [wallet, live, schedule, armed] = await Promise.all([getSetting("creator_wallet"), getSetting("token_live"), getSetting("schedule"), getSetting("launch_armed")]);
  if (!wallet?.address || live?.ca) return { armed: false };
  const at = schedule?.launchAt ? Date.parse(schedule.launchAt) : null;
  const inWindow = at && Date.now() >= at - 2 * 3600e3 && Date.now() <= at + 12 * 3600e3;
  return { armed: Boolean(armed || inWindow), creatorWallet: wallet.address, launchAt: schedule?.launchAt ?? null };
}
