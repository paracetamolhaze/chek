// Static-site side of the launch minute: write the verified token facts into the repo, commit, build, deploy.
// Used by the local dashboard (owner pastes / confirms the CA) and by the PC agent's launch watcher.
// The production API has already switched by then (server/lib/launch.js); this makes the static pages match.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { paths, readJson, ROOT, slotTime, writeJson } from "./content.mjs";
import { syncReadme } from "./readme.mjs";

export const LAUNCH_FILES = ["config/project.json", "README.md", "content/history.json", "content/schedule.json", "content/x/queue.json", "content/telegram/queue.json"];

/** facts = inspectMint(...).facts (already verified). Returns the commit message. */
export function writeLaunchFiles(ca, f, { creatorBuyUsd = null } = {}) {
  const project = readJson(paths.project);
  project.status = "live";
  Object.assign(project.token, {
    ca,
    createdAt: f.createdAt,
    totalSupply: f.totalSupply,
    decimals: f.decimals,
    tokenProgram: f.tokenProgram,
    mintAuthority: f.mintAuthority,
    freezeAuthority: f.freezeAuthority,
    creatorWallet: f.creatorWallet,
    creatorBuy: f.creatorBuy,
    creationTx: f.creationTx,
    creationFeeSol: f.creationFeeSol,
    creationSolSpent: f.creationSolSpent,
    creatorBuySol: f.creatorBuySol ?? null,
    creatorTokens: f.creatorTokens ?? null,
    creatorPct: f.creatorPct ?? null,
    creatorBuyUsd,
  });
  project.launch.launchedAt = f.createdAt;
  writeJson(paths.project, project);
  syncReadme(project);

  const schedule = readJson(paths.schedule);
  schedule.launchedAt = f.createdAt;
  writeJson(paths.schedule, schedule);

  const history = readJson(paths.history);
  if (!history.entries.some((e) => e.title?.startsWith("Token created"))) {
    history.entries.push({
      date: f.createdAt,
      title: `Token created on ${project.token.launchPlatform}`,
      detail: `Official contract address: ${ca}. Same address on this site, the pinned X post and the pinned Telegram message. Creator buy in the same transaction: ${f.creatorBuy}.`,
      proof: { label: `creation tx ${f.creationTx.slice(0, 8)}…`, href: `https://solscan.io/tx/${f.creationTx}` },
    });
    writeJson(paths.history, history);
  }
  for (const file of [paths.x, paths.tg]) {
    const q = readJson(file);
    for (const p of q.posts) p.publishAfter = slotTime(p.slot, schedule);
    writeJson(file, q);
  }
  return `launch: official contract address ${ca}\n\nVerified on-chain before publishing (symbol, creator wallet, mint/freeze authority, creation tx ${f.creationTx}).`;
}

function run(cmd, args, log, cwd = ROOT) {
  return new Promise((resolve) => {
    // no shell: arguments (commit messages) stay intact on Windows
    const p = spawn(cmd, args, { cwd, shell: false, windowsHide: true, env: process.env });
    p.stdout.on("data", (d) => log.push(...String(d).split("\n").filter(Boolean).slice(-20)));
    p.stderr.on("data", (d) => log.push(...String(d).split("\n").filter(Boolean).slice(-20)));
    p.on("close", (code) => resolve(code));
    p.on("error", (e) => {
      log.push(String(e));
      resolve(1);
    });
  });
}

/** git add + commit (+ push if a remote exists) → next build → deploy. Resolves { ok, log }. */
export async function shipFiles(files, message, log = []) {
  await run("git", ["add", ...files], log);
  if ((await run("git", ["commit", "-m", message], log)) !== 0) log.push("(nothing new to commit)");
  if ((await run("git", ["remote", "get-url", "origin"], [])) === 0) await run("git", ["push"], log);
  // build without npm (npm.cmd can't be spawned without a shell on Windows)
  if ((await run(process.execPath, ["website/scripts/gen-mascots.mjs"], log)) !== 0) return { ok: false, log };
  if ((await run(process.execPath, ["node_modules/next/dist/bin/next", "build"], log, join(ROOT, "website"))) !== 0) return { ok: false, log };
  if (!process.env.VERCEL_TOKEN_FILE && !process.env.VERCEL_TOKEN) {
    log.push("VERCEL_TOKEN_FILE not set — run the deploy yourself: npm run deploy");
    return { ok: false, log };
  }
  const d = await run(process.execPath, ["scripts/deploy.mjs"], log);
  return { ok: d === 0, log };
}
