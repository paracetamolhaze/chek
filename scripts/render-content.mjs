// Renders post images: 5 mascot images (content/mascot) and 10 memes (content/memes), 1080×1080.
//   node scripts/render-content.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../brand/mascot.mjs";
import { close, shoot } from "./lib/render.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const P = JSON.parse(readFileSync(join(ROOT, "config/project.json"), "utf8"));
const MASCOT = join(ROOT, "content/mascot");
const MEMES = join(ROOT, "content/memes");
mkdirSync(MASCOT, { recursive: true });
mkdirSync(MEMES, { recursive: true });

const T = `$${P.ticker}`;
const HOST = (P.links.website || "").replace(/^https?:\/\//, "");
const C = { ink: M.INK, paper: M.PAPER, marker: M.MARKER, stamp: M.STAMP, counter: "#141311", fog: "#a7a193", faded: "#6b665c" };
const S = 1080;

const CSS = `
body{font-family:"Martian Mono",monospace;font-stretch:87.5%;color:${C.ink}}
.f{position:relative;width:${S}px;height:${S}px;overflow:hidden}
.dark{background:${C.counter} radial-gradient(rgba(244,240,230,.07) 1.4px,transparent 1.6px) 0 0/26px 26px;color:${C.paper}}
.yellow{background:${C.marker}}
.paperbg{background:${C.paper}}
.paper{background:${C.paper};color:${C.ink}}
.doto{font-family:"Doto",monospace;font-weight:900}
.zz{--t:14px;-webkit-mask:conic-gradient(from 135deg at top,#0000,#000 1deg 89deg,#0000 90deg) top/calc(2*var(--t)) 51% repeat-x,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/calc(2*var(--t)) 51% repeat-x}
.zzb{--t:14px;-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/calc(2*var(--t)) 100%}
.row{display:flex;align-items:baseline;gap:0;font-size:30px;padding:7px 0;text-transform:uppercase;letter-spacing:.04em}
.row .l{flex:1;border-bottom:3px dotted currentColor;opacity:.35;margin:0 14px;transform:translateY(-8px)}
.dash{height:3px;background:repeating-linear-gradient(90deg,currentColor 0 12px,transparent 12px 22px);opacity:.5;margin:14px 0}
.stamp{display:inline-block;color:${C.stamp};border:6px solid currentColor;outline:3px solid currentColor;outline-offset:6px;padding:.25em .5em .2em;font-weight:800;font-stretch:75%;letter-spacing:.08em;text-transform:uppercase;line-height:1}
.bubble{position:absolute;background:${C.paper};color:${C.ink};font-weight:800;box-shadow:7px 7px 0 #000;padding:.35em .6em;line-height:1.15}
.bubble:after{content:"";position:absolute;bottom:-.45em;left:1.2em;width:.9em;height:.9em;background:${C.paper};transform:rotate(45deg)}
.tag{position:absolute;right:44px;bottom:36px;font-size:22px;letter-spacing:.2em;font-weight:700;opacity:.7}
.cap{font-weight:800;font-stretch:112.5%;letter-spacing:-.02em;line-height:1.02}
`;
// Real hashes at render time — re-render after the repository goes public (hashes may change then).
const gitLog = (n) =>
  execFileSync("git", ["log", `-${n}`, "--format=%h%x09%s"], { cwd: ROOT, encoding: "utf8" })
    .trim()
    .split("\n")
    .map((l) => {
      const [h, s] = l.split("\t");
      const short = s.split(/[:(—]/)[0].trim();
      return [h, short.length > 24 ? short.slice(0, 23) + "…" : short];
    });
const ch = (opts) =>M.svg(M.character(opts), { w: "100%", h: "100%" });
const sign = (dark) => `<div class="tag" style="color:${dark ? C.fog : C.ink}">${T} · ${HOST}</div>`;
const made = [];
const shot = async (dir, name, html) => {
  const out = join(dir, `${name}.png`);
  await shoot({ out, size: [S, S], html, css: CSS });
  made.push(out.replace(ROOT, ""));
};

// ───────── MASCOT IMAGES ─────────
await shot(MASCOT, "01-printing", `<div class="f dark">
  <div class="doto" style="position:absolute;left:60px;top:54px;font-size:64px;color:${C.paper}">03:14 AM</div>
  <div style="position:absolute;left:60px;top:140px;font-size:26px;letter-spacing:.2em;color:${C.fog}">REGISTER #4 · NOBODY BOUGHT ANYTHING</div>
  <div style="position:absolute;left:190px;top:300px;width:700px;height:110px;border-radius:26px;background:#0b0a09;box-shadow:inset 0 2px 0 rgba(255,255,255,.08)"></div>
  <div style="position:absolute;left:230px;top:372px;width:620px;height:20px;border-radius:12px;background:#000"></div>
  <div style="position:absolute;left:340px;top:330px;width:400px;height:600px">${ch({ expr: "neutral", pose: "down", dark: true })}</div>
  <div style="position:absolute;left:190px;top:300px;width:700px;height:82px;border-radius:26px 26px 0 0;background:#0b0a09"></div>
  <div style="position:absolute;left:230px;top:362px;width:620px;height:14px;border-radius:12px;background:#000"></div>
  <div style="position:absolute;left:226px;top:322px;width:12px;height:12px;border-radius:50%;background:#2f7d4f;box-shadow:0 0 14px 4px rgba(47,125,79,.6)"></div>
  ${sign(true)}</div>`);

await shot(MASCOT, "02-receipt", `<div class="f yellow">
  <div style="position:absolute;left:280px;top:240px;width:500px;height:750px">${ch({ expr: "skeptic", pose: "hip" })}</div>
  <div class="bubble" style="left:150px;top:120px;font-size:84px;transform:rotate(-4deg)">receipt?</div>
  ${sign(false)}</div>`);

await shot(MASCOT, "03-void", `<div class="f paperbg">
  <div style="position:absolute;left:120px;top:190px;width:560px;height:840px">${ch({ expr: "angry", pose: "point", prop: "stamp" })}</div>
  <div style="position:absolute;right:70px;top:150px;transform:rotate(-12deg)"><span class="stamp" style="font-size:120px">VOID</span></div>
  <div class="cap" style="position:absolute;left:70px;top:60px;font-size:44px">no receipt? no claim.</div>
  ${sign(false)}</div>`);

await shot(MASCOT, "04-you-bought-what", `<div class="f dark">
  <div class="cap" style="position:absolute;left:70px;top:70px;width:940px;font-size:66px;color:${C.paper}">you bought WHAT<br/>without checking the CA?</div>
  <div style="position:absolute;left:300px;top:310px;width:480px;height:720px">${ch({ expr: "shock", pose: "up", dark: true })}</div>
  ${sign(true)}</div>`);

await shot(MASCOT, "05-live", `<div class="f yellow">
  <div style="position:absolute;left:30px;top:260px;width:480px;height:720px">${ch({ expr: "happy", pose: "point", prop: "stamp" })}</div>
  <div style="position:absolute;right:60px;top:330px;transform:rotate(-8deg);text-align:center"><span class="stamp" style="font-size:76px;background:${C.marker}">LIVE ON<br/>SOLANA</span></div>
  <div class="doto" style="position:absolute;left:70px;top:60px;font-size:120px;line-height:1">${T}</div>
  <div style="position:absolute;right:60px;bottom:110px;width:420px;font-size:26px;line-height:1.4;font-weight:700">CA: only from ${HOST}, our pinned X post and pinned Telegram.</div>
  ${sign(false)}</div>`);

// ───────── MEMES ─────────
const receipt = (rows, { title = "TODAY'S CRYPTO PROMISES", foot = "" } = {}) => `
  <div class="paper zz" style="position:absolute;left:90px;top:70px;width:620px;padding:56px 46px 64px;transform:rotate(-1.5deg);box-shadow:0 30px 60px -20px rgba(0,0,0,.6)">
    <div class="doto" style="font-size:72px;text-align:center;line-height:1">${P.name}</div>
    <div style="text-align:center;font-size:20px;letter-spacing:.25em;color:${C.faded};margin-top:10px">REGISTER #4</div>
    <div class="dash"></div>
    <div style="font-size:24px;font-weight:800;letter-spacing:.12em;margin-bottom:8px">${title}</div>
    ${rows.map(([a, b, red]) => `<div class="row" style="font-size:26px"><span>${a}</span><span class="l"></span><span style="font-weight:800;${red ? `color:${C.stamp}` : ""}">${b}</span></div>`).join("")}
    <div class="dash"></div>
    ${foot}
  </div>`;

await shot(MEMES, "01-itemized-promises", `<div class="f dark">
  ${receipt(
    [
      ["Partnership soon", "VOID", 1],
      ["Audit coming", "VOID", 1],
      ["100x guaranteed", "VOID", 1],
      ["Trust me bro", "VOID", 1],
      ["Memes", "1.00"],
      ["Proof", "1.00"],
    ],
    { foot: `<div class="row" style="font-size:30px;font-weight:800"><span>Verified claims</span><span class="l"></span><span>2</span></div>` },
  )}
  <div style="position:absolute;right:30px;top:380px;width:400px;height:600px">${ch({ expr: "angry", pose: "point", prop: "stamp", dark: true })}</div>
  ${sign(true)}</div>`);

await shot(MEMES, "02-pics-vs-receipts", `<div class="f paperbg">
  <div style="position:absolute;inset:0 0 540px 0;background:#e6dfcf"></div>
  <div style="position:absolute;left:40px;top:40px;width:300px;height:450px">${ch({ expr: "neutral", pose: "down" })}</div>
  <div class="cap" style="position:absolute;left:380px;top:170px;font-size:62px;color:${C.faded};text-decoration:line-through;text-decoration-thickness:8px;text-decoration-color:${C.stamp}">pics or it<br/>didn't happen</div>
  <div style="position:absolute;left:40px;top:580px;width:300px;height:450px">${ch({ expr: "happy", pose: "up" })}</div>
  <div class="cap" style="position:absolute;left:380px;top:700px;font-size:62px"><span style="background:${C.marker};padding:0 .15em">receipts</span> or it<br/>didn't happen</div>
  ${sign(false)}</div>`);

await shot(MEMES, "03-never-dm-first", `<div class="f dark">
  <div style="position:absolute;left:70px;top:80px;width:640px;background:#22211e;border-radius:28px;padding:34px 36px;color:${C.paper};font-size:30px;line-height:1.4;font-family:system-ui,sans-serif">
    <div style="font-size:22px;color:${C.fog};margin-bottom:10px">“${P.name} Support ✅” · new message</div>
    hey fren 👋 admin here. your wallet needs validation for the airdrop. just send your seed phrase and we'll fix it 🙏
  </div>
  <div style="position:absolute;left:150px;top:150px;transform:rotate(-14deg)"><span class="stamp" style="font-size:130px;background:rgba(20,19,17,.55)">VOID</span></div>
  <div style="position:absolute;right:50px;top:420px;width:400px;height:600px">${ch({ expr: "angry", pose: "point", prop: "stamp", dark: true })}</div>
  <div class="cap" style="position:absolute;left:70px;top:520px;width:560px;font-size:58px;color:${C.paper}">admins never DM first.</div>
  <div style="position:absolute;left:70px;top:720px;width:540px;font-size:28px;line-height:1.45;color:${C.fog}">nobody legit will ever ask for your seed phrase. not us. not anyone.</div>
  ${sign(true)}</div>`);

await shot(MEMES, "04-ca-chek", `<div class="f yellow">
  <div class="cap" style="position:absolute;left:70px;top:70px;width:940px;font-size:60px">me checking the CA<br/>for the 4th time:</div>
  <div style="position:absolute;left:120px;top:270px;width:520px;height:780px">${ch({ expr: "skeptic", pose: "point", prop: "magnifier" })}</div>
  <div class="paper" style="position:absolute;right:60px;top:380px;width:400px;padding:30px;font-size:30px;line-height:1.7;box-shadow:7px 7px 0 ${C.ink};font-weight:700">
    site ✓<br/>pinned on X ✓<br/>pinned in TG ✓<br/>DM from “admin” ✗
  </div>
  ${sign(false)}</div>`);

await shot(MEMES, "05-the-shredder", `<div class="f dark">
  <div class="doto" style="position:absolute;left:60px;top:50px;font-size:96px;line-height:1;color:${C.paper}">THE SHREDDER</div>
  <div style="position:absolute;left:62px;top:160px;font-size:28px;letter-spacing:.14em;color:${C.fog}">LORE · VILLAIN #1</div>
  <div style="position:absolute;left:40px;top:260px;width:520px;height:780px">${M.svg(M.shredder(), { w: "100%", h: "100%" })}</div>
  <div style="position:absolute;right:50px;top:330px;width:420px;font-size:32px;line-height:1.5;color:${C.paper}">
    eats evidence.<br/><br/>deleted tweets.<br/>wiped websites.<br/>devs who “went for a walk”.<br/><br/><span style="color:${C.marker}">leaves only confetti.</span>
  </div>
  <div style="position:absolute;right:60px;top:820px;width:150px;height:225px">${ch({ expr: "shock", pose: "up", dark: true })}</div>
  ${sign(true)}</div>`);

await shot(MEMES, "06-the-coupon", `<div class="f paperbg">
  <div class="doto" style="position:absolute;left:60px;top:50px;font-size:96px;line-height:1">THE COUPON</div>
  <div style="position:absolute;left:62px;top:160px;font-size:28px;letter-spacing:.14em;color:${C.faded}">LORE · VILLAIN #2</div>
  <div style="position:absolute;left:30px;top:230px;width:540px;height:810px">${M.svg(M.coupon(), { w: "100%", h: "100%" })}</div>
  <div style="position:absolute;right:60px;top:300px;width:400px;font-size:30px;line-height:1.5">
    loud. shiny.<br/>always expiring.<br/><br/>chek's rule for coupons:<br/><b>read the fine print.</b><br/><b>then don't.</b>
  </div>
  <div style="position:absolute;right:50px;top:700px;width:220px;height:330px">${ch({ expr: "skeptic", pose: "point", prop: "magnifier" })}</div>
  ${sign(false)}</div>`);

await shot(MEMES, "07-receipts-fade", `<div class="f dark">
  <div class="cap" style="position:absolute;left:70px;top:70px;font-size:76px;color:${C.paper}">receipts fade.<br/><span style="color:${C.marker}">commits don't.</span></div>
  <div style="position:absolute;left:80px;top:330px;width:400px;height:600px;opacity:.28;filter:grayscale(1)">${ch({ expr: "sleep", pose: "down", dark: true })}</div>
  <div style="position:absolute;right:60px;top:360px;width:520px;background:#0d0c0b;border:2px solid rgba(244,240,230,.15);padding:26px 28px;font-size:24px;line-height:1.75;color:${C.paper}">
    <div style="color:${C.fog}">$ git log --oneline</div>
    ${gitLog(5).map(([h, s]) => `<div><span style="color:${C.marker}">${h}</span> ${s}</div>`).join("")}
  </div>
  <div style="position:absolute;right:60px;top:760px;width:520px;font-size:24px;line-height:1.5;color:${C.fog}">every step of ${T} is a commit. cross-check it with X, Telegram and, after launch, the chain.</div>
  ${sign(true)}</div>`);

await shot(MEMES, "08-long-receipt", `<div class="f yellow">
  <div class="cap" style="position:absolute;left:70px;top:70px;width:560px;font-size:56px">our build log<br/>after one week:</div>
  <div style="position:absolute;left:70px;top:330px;width:400px;height:600px">${ch({ expr: "happy", pose: "hold" })}</div>
  <div class="paper zzb" style="position:absolute;left:260px;top:600px;width:200px;height:520px;transform:rotate(-8deg);transform-origin:top;padding:20px 18px;font-size:13px;line-height:1.9;box-shadow:0 10px 30px rgba(0,0,0,.25)">
    ${Array.from({ length: 14 }, (_, i) => `<div style="display:flex"><span style="width:${50 + ((i * 37) % 70)}px;height:9px;background:#9a958a;margin-top:8px"></span><span style="flex:1"></span><span style="width:26px;height:9px;background:#9a958a;margin-top:8px"></span></div>`).join("")}
  </div>
  <div class="paper" style="position:absolute;right:60px;top:300px;width:430px;padding:28px;font-size:28px;line-height:1.6;box-shadow:7px 7px 0 ${C.ink}">
    CVS: <b>4 ft</b><br/>us: <b>still printing</b><br/><br/><span style="font-size:22px;color:${C.faded}">every line has a receipt → ${HOST}/history</span>
  </div>
  ${sign(false)}</div>`);

await shot(MEMES, "09-vibe-chek", `<div class="f paperbg">
  <div style="position:absolute;left:640px;top:300px;width:420px;height:630px">${ch({ expr: "wink", pose: "wave" })}</div>
  <div style="position:absolute;left:70px;top:120px">
    ${[
      ["vibe chek", "✓", C.ink],
      ["CA chek", "✓", C.ink],
      ["receipt chek", "✓", C.ink],
      ["“trust me bro”", "✗", C.stamp],
    ]
      .map(([a, b, c]) => `<div class="cap" style="font-size:54px;margin-bottom:34px;color:${c}">${a} <span style="font-family:system-ui">${b}</span></div>`)
      .join("")}
  </div>
  <div style="position:absolute;left:70px;top:650px;transform:rotate(-6deg)"><span class="stamp" style="font-size:72px">PASSED</span></div>
  ${sign(false)}</div>`);

await shot(MEMES, "10-receipt-of-the-week", `<div class="f dark">
  <div class="doto" style="position:absolute;left:60px;top:60px;font-size:84px;line-height:1.05;color:${C.paper}">RECEIPT<br/>OF THE WEEK</div>
  <div style="position:absolute;left:62px;top:270px;width:560px;font-size:30px;line-height:1.55;color:${C.paper}">
    post the most absurd <b style="background:${C.marker};color:${C.ink};padding:0 .2em">real</b> receipt you have.<br/><br/>
    best one gets printed into the lore.<br/><br/>
    <span style="color:${C.fog};font-size:24px">rules: real receipt, hide your card digits & address. no prizes in money — just glory and a line in the long receipt.</span>
  </div>
  <div style="position:absolute;right:40px;top:300px;width:440px;height:660px">${ch({ expr: "skeptic", pose: "point", dark: true })}</div>
  ${sign(true)}</div>`);

await close();
console.log(made.join("\n"));
