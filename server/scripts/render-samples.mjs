// Renders sample receipts in every format into .samples/ (PNG + SVG), checks the Code 128 encoder, times each render.
//   node scripts/render-samples.mjs            all samples
//   node scripts/render-samples.mjs gen-void   only samples whose name contains "gen-void"
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CODE128_PATTERNS, FORMAT_NAMES, code128, receiptSvg, renderPng, textReceiptSvg } from "../lib/render.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, ".samples");
mkdirSync(OUT, { recursive: true });

// ── Code 128 self-check: table shape, bar parity, round trip ─
function checkCode128() {
  const P = CODE128_PATTERNS;
  const sum = (p) => Array.from(p, Number).reduce((a, b) => a + b, 0);
  if (P.length !== 107) throw new Error(`code128: ${P.length} patterns, expected 107`);
  if (new Set(P).size !== 107) throw new Error("code128: duplicate patterns");
  P.forEach((p, v) => {
    if (sum(p) !== (v === 106 ? 13 : 11)) throw new Error(`code128: pattern ${v} has ${sum(p)} modules`);
    const bars = Array.from(p, Number).filter((_, i) => i % 2 === 0);
    if (bars.reduce((a, b) => a + b, 0) % 2) throw new Error(`code128: pattern ${v} breaks bar parity`); // bars are always even
  });
  // decode what the encoder produced
  for (const sample of ["CHEK-0042", "CHEK-4821", "Hello, World! ~"]) {
    const w = code128(sample).join("");
    const vals = [];
    for (let i = 0; i < w.length - 7; i += 6) vals.push(P.indexOf(w.slice(i, i + 6)));
    if (w.slice(-7) !== P[106] || vals[0] !== 104) throw new Error("code128: bad start/stop");
    const check = vals.pop();
    const want = vals.reduce((s, v, i) => s + v * (i || 1), 0) % 103;
    const text = vals.slice(1).map((v) => String.fromCharCode(v + 32)).join("");
    if (check !== want || text !== sample) throw new Error(`code128: round trip failed for ${sample}`);
  }
  return "code128 ok (107 patterns, parity, round trip)";
}

const DATE = "2026-10-02T14:05:00Z";
const SAMPLES = [
  // build log entry: project reported, never shown as verified
  [
    "build-holder-verify",
    receiptSvg,
    {
      number: 42,
      title: "HOLDER VERIFY",
      status: "SHIPPED",
      verification: "PROJECT REPORTED",
      lines: [
        ["Feature", "wallet holder check"],
        ["Access", "read-only"],
      ],
      date: DATE,
      proof: "commit 39bcca1",
      mascot: { expr: "happy", pose: "point", prop: "stamp" },
    },
  ],
  // on-chain event with a transaction
  [
    "onchain-creator-fees",
    receiptSvg,
    {
      number: 43,
      title: "CREATOR FEES CLAIMED",
      status: "PAID",
      verification: "ON-CHAIN VERIFIED",
      amount: "0.84 SOL",
      lines: [
        ["Source", "pump.fun creator fees"],
        ["To", "treasury 7Hq…xP2"],
      ],
      date: "2026-10-02T09:41:00Z",
      proof: "TX 5xq…9Ab",
    },
  ],
  // long title + many lines, stamp that needs two lines
  [
    "build-long-title",
    receiptSvg,
    {
      number: 7,
      title: "WEBSITE SHOWS EVERY RECEIPT WITH ITS PROOF LINK",
      status: "VERIFIED HOLDER",
      verification: null,
      lines: [
        ["Pages", "home, history, receipts"],
        ["Checks", "12 passed"],
        ["Deploy", "vercel production"],
        ["Very long label that keeps going and going", "ok"],
      ],
      date: "2026-10-01T23:59:00Z",
      proof: "commit 4cbb491",
      mascot: { expr: "skeptic", pose: "hip" },
    },
  ],
  // the viral generator format
  [
    "gen-john-owes",
    textReceiptSvg,
    {
      headline: "JOHN STILL OWES ME $20",
      body: "lent it for 'gas fees' in march.\nhe said he'd pay me back after the pump.",
      items: [
        ["PROMISED TO BUY THE DIP", "DID NOT BUY"],
        ["SAID 'WEN LAMBO'", "3 TIMES"],
        ["PAID ME BACK", "NOPE"],
      ],
      total: "$0.00",
      username: "degen_dave",
      stamp: "UNVERIFIED",
      character: "chek",
      template: "classic",
      number: 4821,
      date: DATE,
    },
  ],
  // void template with the coupon villain
  [
    "gen-void-coupon",
    textReceiptSvg,
    {
      headline: "100X GUARANTEED",
      body: "limited offer. today only. trust me bro.",
      items: [
        ["PARTNERSHIP SOON", "SOON"],
        ["AUDIT COMING", "COMING"],
        ["DEV IS BASED", "DOXXED?"],
      ],
      total: "100X",
      stamp: "VOID",
      character: "coupon",
      template: "void",
      number: 1337,
      date: DATE,
    },
  ],
  // endless receipt with the shredder
  [
    "gen-long-shredder",
    textReceiptSvg,
    {
      headline: "MY 2026 PORTFOLIO",
      items: [
        ["BOUGHT THE TOP", "YES"],
        ["SOLD THE BOTTOM", "YES"],
        ["TOOK PROFITS", "NEVER"],
        ["READ THE WHITEPAPER", "NO"],
        ["CHECKED THE CA", "ONCE"],
        ["FOLLOWED A CALLER", "17 TIMES"],
      ],
      total: "-97%",
      username: "paperhands",
      stamp: "VERIFIED",
      character: "shredder",
      template: "long",
      number: 9,
      date: DATE,
    },
  ],
  // every field at its limit: nothing may overflow the paper or the canvas
  [
    "build-max",
    receiptSvg,
    {
      number: 9999,
      title: "TREASURY WALLET MOVED FUNDS TO THE LIQUIDITY POOL AFTER THE VOTE",
      status: "VERIFIED HOLDER",
      verification: "ON-CHAIN VERIFIED",
      amount: "123,456.789 SOL",
      lines: Array.from({ length: 8 }, (_, i) => [`Line item number ${i + 1} with a long label`, i % 2 ? "ok" : "a fairly long value here"]),
      date: DATE,
      proof: "TX 5xqA8f3kP2mZ9Ab7Yt1Lw4Rc6Nv0Hs2Qe8Jd5Gu3Fb1",
      footer: "RECEIPTS OR IT DIDN'T HAPPEN — AND THIS FOOTER IS LONG ON PURPOSE",
      mascot: { expr: "shock", pose: "up" },
    },
  ],
  [
    "gen-max",
    textReceiptSvg,
    {
      headline: "MY LANDLORD SAID THE HEATING WOULD BE FIXED BY MONDAY, WHICH MONDAY THOUGH",
      body: "day 1: he said monday.\nday 8: he said monday again.\nday 15: bought a space heater.\nday 22: the space heater has a better track record than my landlord, my ex and my portfolio combined. receipts below, every single one of them is real.",
      items: Array.from({ length: 8 }, (_, i) => [`PROMISE #${i + 1}: IT WILL BE FIXED BY MONDAY`, i % 3 ? "NOT FIXED" : "STILL WAITING"]),
      total: "0 WORKING HEATERS",
      username: "a_very_long_username_that_goes_on",
      stamp: "UNVERIFIED",
      character: "chek",
      number: 7,
      date: DATE,
    },
  ],
  // hostile / odd input: markup, emoji, Cyrillic, no-space strings
  [
    "gen-stress",
    textReceiptSvg,
    {
      headline: "<script>alert(1)</script> & ВАСЯ ДОЛЖЕН 💀",
      body: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA 🚀🚀 \"quotes\" & <tags>",
      items: [["a&b <c>", "\"d\""], ["0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "ok"]],
      total: "₽ 1 000",
      username: "@<img src=x>",
      stamp: "VERIFIED",
      character: null,
      number: 1,
      date: "not a date",
    },
  ],
];

const only = process.argv[2];
const log = [checkCode128()];
const times = [];
renderPng(receiptSvg({ number: 1, title: "WARM UP" }), 200); // first call loads the native module
for (const [name, build, spec] of SAMPLES) {
  if (only && !name.includes(only)) continue;
  for (const format of FORMAT_NAMES) {
    const t0 = performance.now();
    const svg = build({ ...spec, format });
    const png = renderPng(svg, null);
    const ms = performance.now() - t0;
    times.push(ms);
    writeFileSync(join(OUT, `${name}-${format}.png`), png);
    writeFileSync(join(OUT, `${name}-${format}.svg`), svg);
    log.push(`${name}-${format}.png  ${(png.length / 1024).toFixed(0)} KB  ${ms.toFixed(0)} ms`);
  }
}
const bytes = (p) => statSync(p).size;
const fontDir = join(ROOT, "fonts");
const fontBytes = readdirSync(fontDir).reduce((a, f) => a + bytes(join(fontDir, f)), 0);
log.push(
  `renders: ${times.length}, max ${Math.max(...times).toFixed(0)} ms, avg ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)} ms`,
  `fonts/ ${(fontBytes / 1024).toFixed(0)} KB, lib/render.js ${(bytes(join(ROOT, "lib/render.js")) / 1024).toFixed(1)} KB`,
);
console.log(log.join("\n"));
