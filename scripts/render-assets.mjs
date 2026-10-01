// Renders every brand image from code: favicon set, social avatars, X header, token image, OG card, meme-kit poses.
//   node scripts/render-assets.mjs
// Sources: brand/mascot.mjs (mascot + villains + logo mark), config/project.json (name, ticker, URL).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../brand/mascot.mjs";
import { close, shoot } from "./lib/render.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const P = JSON.parse(readFileSync(join(ROOT, "config/project.json"), "utf8"));
const APP = join(ROOT, "website/src/app");
const KIT = join(ROOT, "website/public/kit");
const PUB = join(ROOT, "website/public");
// Official profile images (X/Telegram avatars, X header, token image) are not deployed with the site's meme kit.
const SOCIAL = join(ROOT, "brand/social");
mkdirSync(KIT, { recursive: true });
mkdirSync(SOCIAL, { recursive: true });

const T = `$${P.ticker}`;
const HOST = (P.links.website || "").replace(/^https?:\/\//, "");
const C = { ink: M.INK, paper: M.PAPER, marker: M.MARKER, stamp: M.STAMP, counter: "#141311", fog: "#a7a193" };

const BASE_CSS = `
body{font-family:"Martian Mono",monospace;font-stretch:87.5%;color:${C.paper}}
.dots{background:${C.counter} radial-gradient(rgba(244,240,230,.07) 1.2px, transparent 1.4px) 0 0/22px 22px}
.paper{background:${C.paper};color:${C.ink}}
.doto{font-family:"Doto",monospace;font-weight:900}
.zz{--t:12px;-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/calc(2*var(--t)) 100%}
.zzt{--t:12px;-webkit-mask:conic-gradient(from 135deg at top,#0000,#000 1deg 89deg,#0000 90deg) top/calc(2*var(--t)) 51% repeat-x,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/calc(2*var(--t)) 51% repeat-x}
.bubble{position:absolute;background:${C.paper};color:${C.ink};font-weight:800;box-shadow:5px 5px 0 #000;padding:.35em .6em}
.bubble:after{content:"";position:absolute;bottom:-.4em;left:1em;width:.8em;height:.8em;background:${C.paper};transform:rotate(45deg)}
.stamp{display:inline-block;color:${C.stamp};border:4px solid currentColor;outline:2px solid currentColor;outline-offset:4px;padding:.3em .6em .25em;font-weight:800;font-stretch:75%;letter-spacing:.08em;text-transform:uppercase;line-height:1}
`;

const char = (opts, viewBox = "0 0 400 600", w = "100%", h = "100%") => M.svg(M.character(opts), { w, h, viewBox });
const out = [];
const shot = async (file, size, html, css = "", transparent = false) => {
  await shoot({ out: file, size, html, css: BASE_CSS + css, transparent });
  out.push(file.replace(ROOT, ""));
};

// ── Avatar / token image: yellow, upper body, face big (reads at 48px on pump.fun lists) ──
const avatarHtml = (s) =>
  `<div style="width:${s}px;height:${s}px;background:${C.marker};display:flex;align-items:center;justify-content:center">
     <div style="width:${s}px;height:${s}px;transform:rotate(-3deg) translateY(${s * 0.02}px)">${char({ expr: "skeptic", pose: "down", withLegs: false, shadow: false }, "20 26 360 360")}</div>
   </div>`;
await shot(join(SOCIAL, "x-avatar-400.png"), [400, 400], avatarHtml(400));
await shot(join(SOCIAL, "telegram-avatar-640.png"), [640, 640], avatarHtml(640));
await shot(join(SOCIAL, "token-1000.png"), [1000, 1000], avatarHtml(1000));

// ── Favicon set (yellow tile + logo mark) ──
const mark = (bg) => M.symbol({ bg }).replace("<svg ", '<svg width="100%" height="100%" ');
writeFileSync(join(APP, "icon.svg"), M.symbol({ bg: C.marker }));
writeFileSync(join(KIT, "logo-mark.svg"), M.symbol());
await shot(join(APP, "apple-icon.png"), [180, 180], `<div style="width:180px;height:180px;background:${C.marker}">${M.symbol().replace("<svg ", '<svg width="180" height="180" ')}</div>`);
await shot(join(PUB, "icon-192.png"), [192, 192], `<div style="width:192px;height:192px;background:${C.marker}">${M.symbol().replace("<svg ", '<svg width="192" height="192" ')}</div>`);
await shot(join(PUB, "icon-512.png"), [512, 512], `<div style="width:512px;height:512px;background:${C.marker}">${M.symbol().replace("<svg ", '<svg width="512" height="512" ')}</div>`);
await shot(join(KIT, "logo-mark-1024.png"), [1024, 1024], `<div style="width:1024px;height:1024px">${mark("")}</div>`, "", true);
const icoPngs = [];
for (const s of [16, 32, 48]) {
  const f = join(ROOT, `.preview/fav-${s}.png`);
  mkdirSync(join(ROOT, ".preview"), { recursive: true });
  await shoot({ out: f, size: [s, s], html: `<div style="width:${s}px;height:${s}px">${mark(C.marker)}</div>`, transparent: true });
  icoPngs.push({ s, data: readFileSync(f) });
}
{
  // ICO container with PNG payloads
  const head = Buffer.alloc(6 + 16 * icoPngs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(icoPngs.length, 4);
  let offset = head.length;
  icoPngs.forEach(({ s, data }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(s, o);
    head.writeUInt8(s, o + 1);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(data.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  writeFileSync(join(APP, "favicon.ico"), Buffer.concat([head, ...icoPngs.map((p) => p.data)]));
  out.push("/website/src/app/favicon.ico");
}

// ── Wordmark ──
for (const [name, color] of [["wordmark-ink", C.ink], ["wordmark-paper", C.paper]]) {
  await shot(
    join(KIT, `${name}.png`),
    [1200, 400],
    `<div style="width:1200px;height:400px;display:flex;align-items:center;justify-content:center"><span class="doto" style="font-size:300px;line-height:1;color:${color};letter-spacing:.02em">${P.name}</span></div>`,
    "",
    true,
  );
}

// ── X header 1500×500 (keep lower-left clear: the avatar covers it) ──
await shot(
  join(SOCIAL, "x-header-1500x500.png"),
  [1500, 500],
  `<div class="dots" style="position:relative;width:1500px;height:500px;overflow:hidden">
    <div class="paper zzt" style="position:absolute;left:430px;top:96px;width:700px;padding:34px 44px 40px;transform:rotate(-2.5deg);box-shadow:0 30px 50px -20px #000">
      <div style="display:flex;justify-content:space-between;font-size:15px;letter-spacing:.3em;font-weight:700;color:#6b665c"><span>REGISTER #4</span><span>${P.name}</span></div>
      <div class="doto" style="font-size:150px;line-height:.95;margin-top:8px">${P.name}</div>
      <div style="height:2px;margin:18px 0 14px;background:repeating-linear-gradient(90deg,${C.ink} 0 8px,transparent 8px 14px);opacity:.5"></div>
      <div style="font-size:26px;font-weight:800;font-stretch:112.5%;letter-spacing:-.01em">Receipts or it didn't happen.</div>
      <div style="margin-top:8px;font-size:15px;letter-spacing:.18em;color:#6b665c">MEME COIN · SOLANA · ${HOST.toUpperCase()}</div>
    </div>
    <div style="position:absolute;right:70px;top:46px;width:300px;height:450px">${char({ expr: "skeptic", pose: "point", prop: "magnifier", dark: true })}</div>
    <div class="bubble" style="right:345px;top:22px;font-size:26px;transform:rotate(-4deg)">receipt?</div>
  </div>`,
);

// ── OpenGraph / Twitter card 1200×630 ──
const og = `<div class="dots" style="position:relative;width:1200px;height:630px;overflow:hidden">
  <div style="position:absolute;left:70px;top:70px;width:640px">
    <div style="font-size:18px;letter-spacing:.3em;color:${C.fog};font-weight:700">${P.name} · ${T} · ${P.status === "live" ? "ON SOLANA" : "LAUNCHING ON SOLANA"}</div>
    <div style="margin-top:22px;font-size:78px;line-height:.98;font-weight:800;font-stretch:112.5%;letter-spacing:-.035em">Receipts or it didn't happen.</div>
    <div style="margin-top:26px;font-size:22px;line-height:1.45;color:rgba(244,240,230,.85)">One rule: every claim comes with a receipt.</div>
  </div>
  <div style="position:absolute;left:70px;bottom:56px;display:flex;align-items:center;gap:18px">
    <span class="doto" style="font-size:54px;line-height:1">${P.name}</span>
    <span style="font-size:18px;letter-spacing:.16em;color:${C.fog}">${HOST}</span>
  </div>
  <div class="paper zz" style="position:absolute;right:70px;top:0;width:360px;height:560px;box-shadow:0 30px 60px -20px #000">
    <div style="position:absolute;inset:40px 30px 30px">${char({ expr: "skeptic", pose: "hip" })}</div>
  </div>
  <div class="bubble" style="right:300px;top:60px;font-size:28px;transform:rotate(-4deg)">receipt?</div>
</div>`;
await shot(join(APP, "opengraph-image.png"), [1200, 630], og);
await shot(join(APP, "twitter-image.png"), [1200, 630], og);
const ALT = `${P.name} — Receipts or it didn't happen. A meme coin ${P.status === "live" ? "on" : "launching on"} Solana; token ${T}.`;
writeFileSync(join(APP, "opengraph-image.alt.txt"), ALT);
writeFileSync(join(APP, "twitter-image.alt.txt"), ALT);

// ── Meme kit: transparent poses + villains ──
const POSES = [
  ["skeptic", { expr: "skeptic", pose: "hip" }],
  ["neutral", { expr: "neutral", pose: "down" }],
  ["happy", { expr: "happy", pose: "up" }],
  ["shock", { expr: "shock", pose: "up" }],
  ["stamp", { expr: "angry", pose: "point", prop: "stamp" }],
  ["magnifier", { expr: "skeptic", pose: "point", prop: "magnifier" }],
  ["wave", { expr: "wink", pose: "wave" }],
  ["sleep", { expr: "sleep", pose: "down" }],
];
for (const [name, opts] of POSES) {
  await shot(join(KIT, `chek-${name}.png`), [800, 1200], char(opts), "", true);
}
await shot(join(KIT, "villain-shredder.png"), [800, 1200], M.svg(M.shredder(), { w: "100%", h: "100%" }), "", true);
await shot(join(KIT, "villain-coupon.png"), [800, 1200], M.svg(M.coupon(), { w: "100%", h: "100%" }), "", true);

await close();
console.log(out.join("\n"));
