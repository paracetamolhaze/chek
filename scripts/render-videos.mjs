// Short brand videos for posts (1080×1080 MP4, H.264, no audio — X and Telegram autoplay muted).
//   node scripts/render-videos.mjs [name…]      → content/animations/<name>.mp4 + <name>.png (poster frame)
// Scenes are HTML/CSS animations; every frame is set explicitly through the Web Animations API (no realtime capture),
// so output is deterministic. ffmpeg runs with 3 threads at below-normal priority (the owner streams with OBS).
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../brand/mascot.mjs";
import { FONT_CSS, close, open } from "./lib/render.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const P = JSON.parse(readFileSync(join(ROOT, "config/project.json"), "utf8"));
const OUT = join(ROOT, "content/animations");
const TMP = join(ROOT, ".preview/video");
const S = 1080;
const FPS = 30;
const T = `$${P.ticker}`;
const HOST = (P.links.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "");
const HANDLE = `@${P.accounts?.x?.handle ?? "chekcoinsol"}`;
const C = { ink: M.INK, paper: M.PAPER, marker: M.MARKER, stamp: M.STAMP, counter: "#141311", fog: "#a7a193", faded: "#6b665c", ok: "#2f7d4f" };

const ch = (opts) => M.svg(M.character(opts), { w: "100%", h: "100%" });
const villain = (inner) => M.svg(inner, { w: "100%", h: "100%" });
// animation shorthand: a("pop", .5, 1.2) → "pop .5s ease-out 1.2s both"
const a = (name, dur, delay, ease = "cubic-bezier(.2,.9,.25,1)", extra = "both") => `${name} ${dur}s ${ease} ${delay}s ${extra}`;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Martian Mono",monospace;font-stretch:87.5%;color:${C.ink}}
.f{position:relative;width:${S}px;height:${S}px;overflow:hidden}
.abs{position:absolute}
.dark{background:${C.counter} radial-gradient(rgba(244,240,230,.07) 1.4px,transparent 1.6px) 0 0/26px 26px;color:${C.paper}}
.yellow{background:${C.marker}}
.paper{background:${C.paper};color:${C.ink}}
.doto{font-family:"Doto",monospace;font-weight:900;letter-spacing:.02em}
.teeth{--t:14px;-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/calc(2*var(--t)) 100%}
.row{display:flex;align-items:baseline;font-size:30px;padding:8px 0;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.row .l{flex:1;border-bottom:3px dotted currentColor;opacity:.35;margin:0 14px;transform:translateY(-8px)}
.dash{height:3px;background:repeating-linear-gradient(90deg,currentColor 0 12px,transparent 12px 22px);opacity:.45;margin:16px 0}
.stamp{display:inline-block;color:${C.stamp};border:7px solid currentColor;outline:3px solid currentColor;outline-offset:6px;padding:.22em .5em .16em;font-weight:800;font-stretch:75%;letter-spacing:.08em;text-transform:uppercase;line-height:1;background:rgba(244,240,230,.0)}
.ink{background:transparent!important;mix-blend-mode:multiply}
.teethstrip{height:28px;background:${C.paper};--t:14px;-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/calc(2*var(--t)) 100%}
.bubble{background:${C.paper};color:${C.ink};font-weight:800;box-shadow:7px 7px 0 #000;padding:.32em .6em;line-height:1.1}
.bubble:after{content:"";position:absolute;bottom:-.42em;left:1.1em;width:.85em;height:.85em;background:${C.paper};transform:rotate(45deg)}
.tag{position:absolute;right:42px;bottom:34px;font-size:22px;letter-spacing:.2em;font-weight:700;opacity:.75;text-transform:uppercase}
.cap{font-weight:800;font-stretch:112.5%;letter-spacing:-.02em;line-height:1.02}
.btn{display:inline-block;background:${C.ink};color:${C.paper};font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:18px 28px;font-size:24px;box-shadow:6px 6px 0 ${C.marker}}
@keyframes in-up{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:none}}
@keyframes in-left{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}
@keyframes in-right{from{opacity:0;transform:translateX(420px)}to{opacity:1;transform:none}}
@keyframes fade-in{from{opacity:0}to{opacity:1}}
@keyframes fade-out{from{opacity:1}to{opacity:0}}
@keyframes print{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 -40px 0)}}
@keyframes slam{0%{opacity:0;transform:rotate(var(--r,-10deg)) scale(2.4)}55%{opacity:1;transform:rotate(var(--r,-10deg)) scale(.9)}100%{opacity:1;transform:rotate(var(--r,-10deg)) scale(1)}}
@keyframes pop{0%{opacity:0;transform:scale(.55) rotate(var(--r,0deg))}70%{opacity:1;transform:scale(1.07) rotate(var(--r,0deg))}100%{opacity:1;transform:scale(1) rotate(var(--r,0deg))}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes type{from{width:0}to{width:var(--w)}}
@keyframes press{0%,100%{transform:scale(1)}40%{transform:scale(.93)}}
@keyframes feed{0%{transform:translate(0,0) rotate(-4deg) scale(1);opacity:1}80%{transform:translate(500px,40px) rotate(6deg) scale(.55);opacity:1}100%{transform:translate(540px,60px) rotate(8deg) scale(.4);opacity:0}}
@keyframes fall{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:1}100%{opacity:1;transform:translateY(var(--d,320px)) rotate(var(--rot,14deg))}}
@keyframes flicker{0%,100%{opacity:1}8%{opacity:.25}12%{opacity:1}52%{opacity:1}55%{opacity:.4}58%{opacity:1}}
@keyframes shake{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes scroll-up{from{transform:translateY(0)}to{transform:translateY(var(--y))}}
@keyframes glow{0%,100%{box-shadow:6px 6px 0 ${C.marker}}50%{box-shadow:6px 6px 0 ${C.stamp}}}
`;

const tag = (dark = true) => `<div class="tag" style="color:${dark ? C.fog : C.ink}">${P.name} · ${HANDLE}</div>`;
const endCard = (at, line2) => `
  <div class="abs yellow" style="inset:0;color:${C.ink};animation:${a("fade-in", 0.35, at, "ease-out")}">
    <div class="abs" style="left:70px;top:120px;width:300px;height:450px;animation:${a("in-up", 0.6, at + 0.15)}">${ch({ expr: "happy", pose: "wave" })}</div>
    <div class="abs" style="left:400px;top:150px;width:620px;display:flex;flex-direction:column;gap:26px">
      <div class="doto" style="font-size:210px;line-height:.85;animation:${a("in-up", 0.5, at + 0.25)}">${P.name}</div>
      <div class="cap" style="font-size:50px;animation:${a("in-up", 0.5, at + 0.45)}">receipts or it<br>didn't happen.</div>
      <div style="font-size:24px;line-height:1.5;letter-spacing:.06em;font-weight:700;opacity:.85;animation:${a("in-up", 0.5, at + 0.65)}">${line2}</div>
    </div>
    <div class="abs" style="left:70px;right:70px;top:690px;height:4px;background:repeating-linear-gradient(90deg,${C.ink} 0 14px,transparent 14px 26px);opacity:.5;animation:${a("fade-in", 0.4, at + 0.8)}"></div>
    <div class="abs" style="left:70px;top:730px;font-size:40px;font-weight:800;letter-spacing:.02em;animation:${a("in-up", 0.5, at + 0.9)}">${HOST}</div>
    <div class="abs" style="left:70px;top:795px;font-size:30px;font-weight:700;letter-spacing:.04em;animation:${a("in-up", 0.5, at + 1.0)}">x + telegram: ${HANDLE}</div>
    <div class="abs" style="left:70px;top:860px;font-size:22px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;animation:${a("in-up", 0.5, at + 1.1)}">token ${T} · ${P.status === "live" ? "on solana" : "launching on solana · not launched yet"}</div>
  </div>`;

// ───────────────────────── scenes ─────────────────────────
const VIDEOS = {
  "v01-meet-chek": {
    duration: 9,
    poster: 4.8,
    html: `<div class="f dark">
      <div class="abs" style="inset:0;animation:${a("fade-out", 0.35, 5.7, "ease-in")}">
        <div class="abs" style="left:110px;top:70px;font-size:20px;letter-spacing:.3em;color:${C.fog};font-weight:700;animation:${a("fade-in", 0.4, 0.1)}"><span style="display:inline-block;width:12px;height:12px;border-radius:6px;background:${C.ok};box-shadow:0 0 12px 3px rgba(47,125,79,.7);margin-right:12px"></span>REGISTER #4 · 03:14 AM</div>
        <div class="abs" style="left:100px;top:112px;width:740px;height:48px;border-radius:24px;background:#0b0a09;box-shadow:inset 0 3px 6px #000, 0 1px 0 rgba(255,255,255,.08)"></div>
        <div class="abs" style="left:155px;top:134px;width:630px;height:760px;overflow:hidden">
          <div class="paper teeth" style="padding:46px 48px 70px;animation:${a("print", 2.6, 0.45, "steps(26,end)")}">
            <div class="doto" style="font-size:86px;text-align:center;line-height:1">${P.name}</div>
            <div style="text-align:center;font-size:20px;letter-spacing:.3em;color:${C.faded};margin-top:10px">RECEIPT #0001</div>
            <div class="dash"></div>
            <div class="row">claim<span class="l"></span>partnership soon</div>
            <div class="row">claim<span class="l"></span>100x guaranteed</div>
            <div class="row">claim<span class="l"></span>trust me bro</div>
            <div class="dash"></div>
            <div class="row">proof<span class="l"></span>none</div>
            <div class="row" style="font-weight:800">total<span class="l"></span>0 receipts</div>
            <div style="height:40px"></div>
          </div>
        </div>
        <div class="abs stamp ink" style="left:260px;top:330px;font-size:110px;--r:-12deg;animation:${a("slam", 0.45, 3.25)}">void</div>
        <div class="abs" style="left:795px;top:610px;width:280px;height:420px;animation:${a("in-right", 0.7, 3.9)}">${ch({ expr: "skeptic", pose: "hip", dark: true })}</div>
        <div class="abs bubble" style="left:790px;top:530px;font-size:42px;--r:-5deg;animation:${a("pop", 0.4, 4.5)}">receipt?</div>
      </div>
      ${endCard(5.8, `meet chek — a receipt that only prints what it can prove.`)}
      ${tag(true)}
    </div>`,
  },

  "v02-whats-live": {
    duration: 9,
    poster: 6.4,
    html: `<div class="f dark">
      <div class="abs paper teeth" style="left:150px;top:70px;width:780px;padding:44px 52px 80px;animation:${a("in-up", 0.6, 0.1)}">
        <div class="doto" style="font-size:58px;line-height:1">BUILD RECEIPT</div>
        <div style="font-size:20px;letter-spacing:.28em;color:${C.faded};margin-top:10px">${P.name} · WHAT EXISTS RIGHT NOW</div>
        <div class="dash"></div>
        ${["website", "receipt generator", "telegram receipt bot", "build log", "receipt board", "transparency page"]
          .map((r, i) => `<div class="row" style="animation:${a("in-left", 0.35, 0.9 + i * 0.5)}">${r}<span class="l"></span><b style="color:${C.ok}">live ✓</b></div>`)
          .join("")}
        <div class="row" style="background:${C.marker};margin:6px -12px;padding:8px 12px;animation:${a("in-left", 0.35, 4.1)}">${T}<span class="l"></span><b>next</b></div>
        <div class="dash" style="animation:${a("fade-in", 0.3, 4.6)}"></div>
        <div class="row" style="font-weight:800;animation:${a("in-left", 0.35, 4.8)}">total<span class="l"></span>6 live · 0 promises</div>
      </div>
      <div class="abs stamp ink" style="left:700px;top:96px;font-size:52px;--r:-9deg;animation:${a("slam", 0.45, 5.4)}">shipped</div>
      <div class="abs" style="left:60px;top:650px;width:250px;height:375px;animation:${a("in-up", 0.6, 5.9)}">${ch({ expr: "happy", pose: "point", dark: true })}</div>
      <div class="abs" style="left:330px;top:900px;font-size:26px;letter-spacing:.1em;color:${C.paper};font-weight:700;animation:${a("in-up", 0.5, 6.4)}">every line has a receipt · ${HOST}</div>
      ${tag(true)}
    </div>`,
  },

  "v03-the-shredder": {
    duration: 9,
    poster: 3.6,
    html: `<div class="f dark">
      <div class="abs" style="left:70px;top:70px;font-size:24px;letter-spacing:.3em;color:${C.fog};font-weight:700;animation:${a("fade-in", 0.4, 0.1)}">LORE · CHAPTER 03</div>
      <div class="abs cap" style="left:70px;top:110px;font-size:92px;color:${C.paper};animation:${a("in-up", 0.5, 0.25)}">THE SHREDDER</div>
      <div class="abs" style="left:560px;top:250px;width:440px;height:660px">
        <div style="width:100%;height:100%;animation:bob 1.1s ease-in-out 0s infinite">${villain(M.shredder({ expr: "grin" }))}</div>
      </div>
      <div class="abs paper" style="left:70px;top:380px;width:330px;padding:22px 24px;box-shadow:0 20px 40px -10px #000;font-size:22px;line-height:1.35;font-weight:700;animation:${a("feed", 1.9, 1.0, "cubic-bezier(.5,0,.6,1)")}">DEV:<br>“WE WILL NEVER RUG.”<div style="margin-top:10px;font-size:16px;letter-spacing:.2em;color:${C.faded}">SCREENSHOT · DELETED</div></div>
      ${Array.from({ length: 9 }, (_, i) => `<div class="abs" style="left:${640 + i * 30}px;top:${660 + (i % 3) * 10}px;width:18px;height:${70 + (i * 23) % 50}px;background:${C.paper};border:2px solid ${C.ink};--d:${260 + (i * 41) % 120}px;--rot:${i % 2 ? 16 : -14}deg;animation:${a("fall", 1.6, 2.9 + i * 0.07, "ease-in")}"></div>`).join("")}
      <div class="abs cap" style="left:70px;top:640px;font-size:52px;color:${C.paper};animation:${a("in-up", 0.45, 3.1)}">eats evidence.</div>
      <div class="abs" style="left:70px;top:715px;font-size:26px;color:${C.fog};width:470px;line-height:1.4;animation:${a("in-up", 0.45, 3.4)}">deleted posts. wiped sites. devs who “went for a walk”.</div>
      <div class="abs" style="left:-20px;top:560px;width:0;height:0"></div>
      <div class="abs dark" style="inset:0;animation:${a("fade-in", 0.35, 5.2, "ease-out")}">
        <div class="abs" style="left:110px;top:230px;width:380px;height:570px;animation:${a("in-up", 0.6, 5.35)}">${ch({ expr: "skeptic", pose: "point", prop: "magnifier", dark: true })}</div>
        <div class="abs bubble" style="left:150px;top:150px;font-size:46px;--r:-4deg;animation:${a("pop", 0.4, 5.9)}">receipt?</div>
        <div class="abs cap" style="left:540px;top:380px;width:470px;font-size:64px;color:${C.paper};animation:${a("in-up", 0.5, 6.2)}">chek keeps receipts.</div>
        <div class="abs" style="left:545px;top:560px;width:460px;font-size:26px;color:${C.fog};line-height:1.45;animation:${a("in-up", 0.5, 6.5)}">the shredder hates that.<br>${HOST}</div>
      </div>
      ${tag(true)}
    </div>`,
  },

  "v04-print-demo": {
    duration: 9,
    poster: 5.2,
    html: `<div class="f dark">
      <div class="abs" style="left:110px;top:70px;font-size:22px;letter-spacing:.24em;color:${C.fog};font-weight:700;animation:${a("fade-in", 0.4, 0.1)}">${HOST.toUpperCase()}/PRINT</div>
      <div class="abs cap" style="left:110px;top:105px;font-size:74px;color:${C.paper};animation:${a("in-up", 0.5, 0.2)}">print a receipt.</div>
      <div class="abs paper" style="left:110px;top:220px;width:860px;height:96px;border:4px solid ${C.ink};box-shadow:8px 8px 0 #000;padding:0 28px;display:flex;align-items:center;font-size:40px;font-weight:700;animation:${a("in-up", 0.5, 0.35)}">
        <span style="display:inline-block;overflow:hidden;white-space:nowrap;--w:13ch;animation:${a("type", 1.4, 0.9, "steps(13,end)")}">trust me bro.</span><span style="display:inline-block;width:4px;height:46px;background:${C.ink};margin-left:4px;animation:blink .8s linear 0s infinite"></span>
      </div>
      <div class="abs btn" style="left:110px;top:345px;animation:${a("in-up", 0.4, 0.5)}, ${a("press", 0.3, 2.45, "ease-in-out", "both")}">print receipt</div>
      <div class="abs" style="left:250px;top:440px;width:600px;height:620px;overflow:hidden">
        <div class="paper teeth" style="padding:36px 44px 70px;animation:${a("print", 1.6, 2.7, "steps(18,end)")}">
          <div class="doto" style="font-size:64px;text-align:center;line-height:1">${P.name}</div>
          <div style="text-align:center;font-size:18px;letter-spacing:.28em;color:${C.faded};margin-top:8px">RECEIPT CHK-7F3A2C</div>
          <div class="dash"></div>
          <div class="cap" style="font-size:46px;text-transform:uppercase">“trust me bro.”</div>
          <div class="dash"></div>
          <div class="row" style="font-size:26px">proof<span class="l"></span>none provided</div>
          <div class="row" style="font-size:26px">status<span class="l"></span><b style="color:${C.stamp}">unverified</b></div>
          <div style="font-size:15px;letter-spacing:.14em;color:${C.faded};margin-top:14px;text-align:center">PRINTED BY A VISITOR · NOT A STATEMENT BY ${P.name}</div>
        </div>
      </div>
      <div class="abs stamp ink" style="left:560px;top:560px;font-size:76px;--r:-11deg;animation:${a("slam", 0.45, 4.5)}">void</div>
      <div class="abs btn" style="left:700px;top:345px;background:${C.paper};color:${C.ink};animation:${a("pop", 0.4, 5.2)}, glow .9s ease-in-out 5.6s infinite">share on x</div>
      <div class="abs" style="left:110px;top:980px;font-size:24px;color:${C.paper};letter-spacing:.08em;font-weight:700;animation:${a("in-up", 0.4, 5.8)}">free · no wallet · no sign-up</div>
      ${tag(true)}
    </div>`,
  },

  "v05-the-plan": {
    duration: 10,
    poster: 1.4,
    html: (() => {
      const sec = (title, kick, rows, right, color, at) => `
        <div style="margin-top:26px;animation:${a("in-left", 0.4, at)}">
          <div style="display:flex;align-items:center;gap:16px"><span class="doto" style="font-size:44px">${title}</span><span style="font-size:18px;letter-spacing:.24em;color:${C.faded}">${kick}</span></div>
          ${rows.map((r) => `<div class="row" style="font-size:27px">${r}<span class="l"></span><b style="color:${color}">${right}</b></div>`).join("")}
        </div>`;
      return `<div class="f dark">
        <div class="abs" style="left:170px;top:0;width:740px;height:${S}px;overflow:hidden">
          <div style="--y:-760px;will-change:transform;animation:${a("scroll-up", 6.2, 1.8, "cubic-bezier(.45,0,.55,1)")}"><div class="paper" style="padding:60px 50px 62px">
            <div class="doto" style="font-size:70px;line-height:1">THE PLAN</div>
            <div style="font-size:20px;letter-spacing:.3em;color:${C.faded};margin-top:10px">${P.name} · ITEMIZED · NO DATES WE CAN'T KEEP</div>
            <div class="dash"></div>
            ${sec("NOW", "LIVE", ["website", "receipt generator", "telegram receipt bot", "build log + receipt board"], "✓", C.ok, 0.3)}
            ${sec("LAUNCH", "PUMP.FUN", [`${T} created on pump.fun`, "CA at the same minute: site + x + tg", "creator buy: on-chain receipt"], "→", C.ink, 0.6)}
            ${sec("AFTER", "PLANNED", ["proof of hold", "holder votes", "receipt of the week", "meme generator"], "planned", C.faded, 0.9)}
            ${sec("NEVER", "", ["presale", "price promises", "dms first", "fake partners"], "void", C.stamp, 1.2)}
            <div class="dash"></div>
            <div class="row" style="font-weight:800">total<span class="l"></span>receipts only</div>
          </div><div class="teethstrip"></div></div>
        </div>
        <div class="abs" style="left:830px;top:690px;width:230px;height:345px;animation:${a("in-right", 0.6, 1.2)}">${ch({ expr: "skeptic", pose: "point", dark: true })}</div>
        <div class="abs stamp" style="left:250px;top:840px;font-size:64px;--r:-8deg;animation:${a("slam", 0.45, 8.3)}">itemized</div>
        ${tag(true)}
      </div>`;
    })(),
  },

  "v06-the-coupon": {
    duration: 8.5,
    poster: 4.3,
    html: `<div class="f dark">
      <div class="abs" style="left:70px;top:70px;font-size:24px;letter-spacing:.3em;color:${C.fog};font-weight:700;animation:${a("fade-in", 0.4, 0.1)}">LORE · CHAPTER 04</div>
      <div class="abs cap" style="left:70px;top:110px;font-size:92px;color:${C.paper};animation:${a("in-up", 0.5, 0.25)}">THE COUPON</div>
      <div class="abs" style="left:110px;top:270px;width:440px;height:660px;transform-origin:50% 90%;animation:shake .35s ease-in-out 0s infinite">${villain(M.coupon({ text: "100X OFF!", sub: "TODAY ONLY" }))}</div>
      <div class="abs cap" style="left:590px;top:270px;font-size:56px;color:${C.marker};width:470px;white-space:nowrap;animation:${a("fade-in", 0.2, 0.7)}, flicker 1.3s linear 0.9s infinite">“100X OFF!<br>TODAY ONLY!”</div>
      <div class="abs" style="left:592px;top:420px;font-size:26px;color:${C.fog};width:440px;line-height:1.4;animation:${a("in-up", 0.4, 1.4)}">always expiring.<br>never real.</div>
      <div class="abs" style="left:700px;top:560px;width:300px;height:450px;animation:${a("in-right", 0.6, 2.4)}">${ch({ expr: "angry", pose: "up", prop: "stamp", dark: true })}</div>
      <div class="abs stamp ink" style="left:110px;top:560px;font-size:112px;--r:-14deg;animation:${a("slam", 0.45, 3.3)}">void</div>
      <div class="abs paper" style="left:120px;top:870px;padding:14px 22px;font-size:26px;font-weight:700;box-shadow:6px 6px 0 #000;animation:${a("in-up", 0.4, 4.0)}">fine print: “*none of this is real.”</div>
      <div class="abs" style="left:120px;top:960px;font-size:24px;letter-spacing:.08em;color:${C.paper};font-weight:700;animation:${a("in-up", 0.4, 4.6)}">chek reads the fine print · ${HOST}</div>
      ${tag(true)}
    </div>`,
  },
};

// ───────────────────────── renderer ─────────────────────────
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-threads", "3", ...args], { windowsHide: true });
    try {
      os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch {}
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-500)))));
  });
}

async function render(name, v) {
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const b = await open();
  const page = await b.newPage();
  await page.setViewport({ width: S, height: S });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}${CSS}</style></head><body>${v.html}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const frames = Math.round(v.duration * FPS);
  for (let i = 0; i < frames; i++) {
    const t = (i / FPS) * 1000;
    await page.evaluate((t) => {
      for (const an of document.getAnimations()) {
        an.pause();
        an.currentTime = t;
      }
    }, t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: join(dir, `${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
  }
  // poster frame (PNG) for image posts and previews
  await page.evaluate((t) => {
    for (const an of document.getAnimations()) an.currentTime = t;
  }, v.poster * 1000);
  await page.screenshot({ path: join(OUT, `${name}.png`), type: "png" });
  await page.close();
  await ffmpeg(["-framerate", String(FPS), "-i", join(dir, "%04d.jpg"), "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(OUT, `${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`✓ content/animations/${name}.mp4 (${v.duration}s) + poster`);
}

mkdirSync(OUT, { recursive: true });
const pick = process.argv.slice(2);
for (const [name, v] of Object.entries(VIDEOS)) if (!pick.length || pick.includes(name)) await render(name, v);
await close();
