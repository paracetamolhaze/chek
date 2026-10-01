// FINAL PUMP.FUN FORM card — every value to copy into the Pump.fun create form, in one place, from the one source.
//   node scripts/pumpfun-card.mjs [--usd 200]   → private/pumpfun-card.html (git-ignored; published privately for the phone)
// It is FINAL only when the domain, every link, the ticker and the launch time are final; otherwise it says DRAFT and why.
// The SOL amount for the creator buy is computed from live Pump.fun parameters + the live SOL price at generation time.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { calculator } from "../dashboard/pumpcalc.mjs";
import { paths, readJson, ROOT } from "./lib/content.mjs";

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const usd = Number(arg("--usd", 200));
const p = readJson(paths.project);
const pf = readJson(join(ROOT, "content/pumpfun.json"));
const schedule = readJson(paths.schedule);
const calc = await calculator([usd]);
const row = calc.rows[0];
const site = p.links.website.replace(/\/$/, "");

const notFinal = [
  p.domain?.pending ? `website domain not confirmed (pending ${p.domain.pending})` : null,
  !p.tickerConfirmed ? "ticker not confirmed" : null,
  !p.links.x ? "X link missing" : null,
  !p.links.telegram ? "Telegram link missing" : null,
  !schedule.launchAt ? "launch time not confirmed" : null,
].filter(Boolean);
const final = notFinal.length === 0;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const field = (label, value, note = "") =>
  `<div class="f"><div class="l">${esc(label)}</div><div class="v"><code>${esc(value)}</code><button onclick="cp(this)">Copy</button></div>${note ? `<div class="n">${esc(note)}</div>` : ""}</div>`;
const toggle = (label, value) => `<div class="f t"><div class="l">${esc(label)}</div><div class="v"><b>${esc(value)}</b></div></div>`;

const html = `<title>Pump.fun form card</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--ink:#141311;--paper:#f4f0e6;--fog:#a7a193;--stamp:#d6332a;--ok:#2f7d4f}
body{margin:0;background:var(--ink);color:var(--paper);font:15px/1.45 ui-monospace,Menlo,Consolas,monospace}
main{max-width:560px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:6px 0}.badge{display:inline-block;padding:4px 10px;font-weight:700;border:2px solid}
.final{color:var(--ok);border-color:var(--ok)}.draft{color:var(--stamp);border-color:var(--stamp)}
.f{border-top:1px dashed #3a3732;padding:12px 0}.l{color:var(--fog);font-size:12px;text-transform:uppercase;letter-spacing:.12em}
.v{display:flex;gap:8px;align-items:flex-start;margin-top:4px}.v code{flex:1;white-space:pre-wrap;word-break:break-word}
button{background:var(--paper);color:var(--ink);border:0;padding:6px 10px;font:700 12px ui-monospace,monospace;cursor:pointer}
.n{color:var(--fog);font-size:12px;margin-top:4px}img{max-width:100%;border:1px solid #3a3732}
a{color:var(--paper)}.warn{color:var(--stamp)}
</style>
<main>
<h1>Pump.fun — create form</h1>
<p><span class="badge ${final ? "final" : "draft"}">${final ? "FINAL" : "DRAFT — NOT FINAL"}</span></p>
${final ? "" : `<p class="warn">Do not create the coin from this card: ${esc(notFinal.join("; "))}.</p>`}
<p class="n">Generated ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))} UTC. Coin data is immutable after creation — copy every field from here.</p>
<div class="f"><div class="l">Image (1000×1000)</div><img src="${site}/media/brand/token-1000.png" alt="token image"><div class="n"><a href="${site}/media/brand/token-1000.png" download>Download image</a></div></div>
${field("Name", pf.name)}
${field("Ticker", pf.ticker, "without $")}
${field("Description", pf.description)}
${field("Website", site)}
${field("X / Twitter", p.links.x)}
${field("Telegram", p.links.telegram)}
<div class="f"><div class="l">Banner (1500×500)</div><img src="${site}/media/brand/x-header-1500x500.png" alt="banner"><div class="n"><a href="${site}/media/brand/x-header-1500x500.png" download>Download banner</a></div></div>
${toggle("Pair", pf.pair)}
${toggle("Creator rewards", "Creator")}
${toggle("Holder rewards", "OFF")}
${toggle("Mayhem Mode", "OFF")}
${field("Creator initial buy (SOL)", row.sol.toFixed(4), `≈ $${usd} at $${calc.solUsd.usd.toFixed(2)}/SOL → ≈ ${Math.round(row.tokens).toLocaleString("en-US")} CHEKD (${row.pctSupply.toFixed(2)}% of supply), est. fees ${row.estFeesSol[0].toFixed(3)}–${row.estFeesSol[1].toFixed(3)} SOL. Live estimate as of generation — recompute at T−10 min. The real numbers come from the chain after the mint.`)}
<div class="f"><div class="l">Before you press create</div><div class="n">Open pump.fun by typing it yourself. Wallet funded with at least ${(row.sol + row.estFeesSol[1] + 0.02).toFixed(3)} SOL. Nothing else to do afterwards: the system verifies the coin on-chain and publishes the CA to the site, X and Telegram.</div></div>
</main>
<script>function cp(b){const t=b.previousElementSibling.textContent;navigator.clipboard.writeText(t).then(()=>{b.textContent="Copied";setTimeout(()=>b.textContent="Copy",1500)})}</script>`;
mkdirSync(join(ROOT, "private"), { recursive: true });
writeFileSync(join(ROOT, "private", "pumpfun-card.html"), html);
console.log(`${final ? "FINAL" : "DRAFT"} card → private/pumpfun-card.html${final ? "" : ` (not final: ${notFinal.join("; ")})`}`);
console.log(`creator buy: ${row.sol.toFixed(4)} SOL ≈ $${usd} → ${Math.round(row.tokens).toLocaleString("en-US")} CHEKD (${row.pctSupply.toFixed(2)}%)`);
