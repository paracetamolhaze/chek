// Vertical meme videos for Instagram Reels / TikTok (1080×1920, H.264, no audio — add a trending sound in the app).
//   node scripts/render-shorts.mjs [name…]   → content/shorts/<name>.mp4 + <name>.png
// Same characters, palette and frame-exact renderer as scripts/render-videos.mjs. Safe zone: the important text stays
// between y≈220 and y≈1480 and x≈60–960, clear of the app's caption, buttons and progress bar.
import { join } from "node:path";
import { C, HANDLE, M, P, ROOT, T, a, ch, close, render, villain } from "./render-videos.mjs";

const W = 1080;
const H = 1920;
const OUT = join(ROOT, "content/shorts");

// TikTok-style caption: big, centered, white with a black outline
const meme = (html, top, delay, size = 66) =>
  `<div class="abs cap" style="left:60px;right:60px;top:${top}px;text-align:center;font-size:${size}px;color:${C.paper};text-shadow:0 0 1px #000,4px 4px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000;animation:${a("in-up", 0.45, delay)}">${html}</div>`;
const hide = (at) => `animation:${a("fade-out", 0.25, at, "ease-in")}`;
// vertical end card: CHEK, the motto, the handle
const end = (at, line = "") => `
  <div class="abs yellow" style="inset:0;color:${C.ink};animation:${a("fade-in", 0.3, at, "ease-out")}">
    <div class="abs" style="left:330px;top:260px;width:420px;height:630px;animation:${a("in-up", 0.6, at + 0.1)}">${ch({ expr: "happy", pose: "wave" })}</div>
    <div class="abs doto" style="left:0;right:0;top:930px;text-align:center;font-size:250px;line-height:.85;animation:${a("in-up", 0.5, at + 0.25)}">${P.name}</div>
    <div class="abs cap" style="left:0;right:0;top:1170px;text-align:center;font-size:64px;animation:${a("in-up", 0.5, at + 0.45)}">receipts or it<br>didn't happen.</div>
    <div class="abs" style="left:0;right:0;top:1360px;text-align:center;font-size:40px;font-weight:800;letter-spacing:.04em;animation:${a("in-up", 0.5, at + 0.65)}">${HANDLE}</div>
    <div class="abs" style="left:0;right:0;top:1425px;text-align:center;font-size:24px;letter-spacing:.16em;text-transform:uppercase;opacity:.75;animation:${a("in-up", 0.5, at + 0.8)}">${line || `token ${T} · launching on solana`}</div>
  </div>`;

const receipt = (rows, { top, delay, title = "RECEIPT", w = 900 }) => `
  <div class="abs" style="left:${(W - w) / 2 - 30}px;top:${top - 30}px;width:${w + 60}px;height:52px;border-radius:26px;background:#0b0a09;box-shadow:inset 0 3px 6px #000"></div>
  <div class="abs" style="left:${(W - w) / 2}px;top:${top}px;width:${w}px;overflow:hidden">
    <div class="paper teeth" style="padding:54px 60px 84px;animation:${a("print", 2.2, delay, "steps(22,end)")}">
      <div class="doto" style="font-size:80px;text-align:center;line-height:1">${title}</div>
      <div class="dash"></div>
      ${rows.map(([l, v, red]) => `<div class="row" style="font-size:40px;padding:12px 0">${l}<span class="l"></span><b style="${red ? `color:${C.stamp}` : ""}">${v}</b></div>`).join("")}
      <div class="dash"></div>
      <div class="row" style="font-size:40px;font-weight:800;padding:12px 0">PROOF<span class="l"></span>0.00</div>
    </div>
  </div>`;

const SHORTS = {
  "s01-trust-me-bro": {
    duration: 9.5,
    poster: 4.6,
    html: `<div class="f dark">
      <div style="${hide(6.9)}">
        ${meme("when the dev says<br>“trust me bro”", 230, 0.1)}
        ${receipt(
          [
            ["TRUST ME BRO", "VOID", 1],
            ["PARTNERSHIP SOON", "PENDING"],
            ["100X GEM", "NO RECEIPT", 1],
            ["DEV IS SAFU", "???"],
          ],
          { top: 600, delay: 0.9 },
        )}
        <div class="abs stamp" style="left:170px;top:860px;font-size:190px;--r:-14deg;animation:${a("slam", 0.45, 3.4)}">void</div>
        <div class="abs" style="left:60px;top:1260px;width:330px;height:495px;animation:${a("in-left", 0.5, 4.4)}">${ch({ expr: "angry", pose: "up", prop: "stamp", dark: true })}</div>
        <div class="abs bubble" style="left:390px;top:1330px;font-size:56px;--r:-3deg;animation:${a("pop", 0.4, 5.0)}">receipts or it<br>didn't happen.</div>
      </div>
      ${end(6.9)}
    </div>`,
  },

  "s02-roadmap": {
    duration: 9.5,
    poster: 3.4,
    html: `<div class="f dark">
      <div style="${hide(6.9)}">
        ${meme("POV: you ask the dev<br>for the roadmap", 230, 0.1, 60)}
        <div class="abs" style="left:520px;top:560px;width:520px;height:780px"><div style="width:100%;height:100%;animation:bob 1.1s ease-in-out 0s infinite">${villain(M.shredder({ expr: "grin" }))}</div></div>
        <div class="abs paper" style="left:60px;top:720px;width:420px;padding:26px 28px;box-shadow:0 20px 40px -10px #000;font-size:30px;line-height:1.35;font-weight:800;animation:${a("feed", 2.0, 1.1, "cubic-bezier(.5,0,.6,1)")}">ROADMAP<br>Q1: moon<br>Q2: more moon<br>Q3: partnerships<div style="margin-top:10px;font-size:18px;letter-spacing:.2em;color:${C.faded}">TRUST ME</div></div>
        ${Array.from({ length: 12 }, (_, i) => `<div class="abs" style="left:${600 + i * 28}px;top:${1080 + (i % 3) * 12}px;width:20px;height:${80 + ((i * 23) % 60)}px;background:${C.paper};border:2px solid ${C.ink};--d:${300 + ((i * 41) % 140)}px;--rot:${i % 2 ? 16 : -14}deg;animation:${a("fall", 1.6, 3.0 + i * 0.07, "ease-in")}"></div>`).join("")}
        ${meme("roadmap: shredded.", 1330, 3.6, 66)}
        <div class="abs dark" style="inset:0;animation:${a("fade-in", 0.3, 5.0, "ease-out")}">
          <div class="abs" style="left:340px;top:520px;width:400px;height:600px;animation:${a("in-up", 0.5, 5.1)}">${ch({ expr: "skeptic", pose: "point", prop: "magnifier", dark: true })}</div>
          ${meme("we print ours.", 1180, 5.5, 84)}
          ${meme("every step, with a receipt", 1300, 5.8, 40)}
        </div>
      </div>
      ${end(6.9)}
    </div>`,
  },

  "s03-coupon": {
    duration: 9,
    poster: 3.9,
    html: `<div class="f dark">
      <div style="${hide(6.4)}">
        ${meme("every new coin<br>on day one:", 230, 0.1)}
        <div class="abs" style="left:240px;top:520px;width:600px;height:900px;transform-origin:50% 90%;animation:shake .35s ease-in-out 0s infinite">${villain(M.coupon({ text: "100X OFF!", sub: "TODAY ONLY" }))}</div>
        <div class="abs cap" style="left:60px;right:60px;top:1340px;text-align:center;font-size:58px;color:${C.marker};animation:${a("fade-in", 0.2, 0.8)}, flicker 1.3s linear 1.0s infinite">“100X! TODAY ONLY!”</div>
        <div class="abs stamp ink" style="left:150px;top:780px;font-size:190px;--r:-14deg;animation:${a("slam", 0.45, 3.2)}">void</div>
        <div class="abs paper" style="left:150px;top:1200px;padding:16px 26px;font-size:34px;font-weight:800;box-shadow:7px 7px 0 #000;--r:2deg;animation:${a("pop", 0.4, 4.1)}">fine print: “none of this is real”</div>
      </div>
      ${end(6.4, `chek reads the fine print · token ${T} · launching on solana`)}
    </div>`,
  },

  "s04-print-your-own": {
    duration: 10,
    poster: 4.4,
    html: `<div class="f dark">
      <div style="${hide(7.2)}">
        ${meme("me printing a receipt<br>for my friend who<br>still owes me $20", 200, 0.1, 56)}
        ${receipt(
          [
            ["CLAIM", "“PAY U FRIDAY”"],
            ["FRIDAY", "PASSED"],
            ["AMOUNT", "$20.00"],
            ["STATUS", "UNPAID", 1],
          ],
          { top: 620, delay: 1.0, title: "RECEIPT #0420" },
        )}
        <div class="abs stamp" style="left:90px;top:940px;font-size:80px;--r:-10deg;animation:${a("slam", 0.45, 3.5)}">proof pending</div>
        ${meme("print yours. free.<br>no wallet needed.", 1330, 4.6, 68)}
      </div>
      ${end(7.2, "the receipt printer · chekcoinsol.xyz")}
    </div>`,
  },

  "s05-airdrops": {
    duration: 10,
    poster: 5.6,
    html: `<div class="f dark">
      <div style="${hide(7.4)}">
        ${meme("two kinds of airdrops", 220, 0.1)}
        <div class="abs paper" style="left:90px;right:90px;top:420px;padding:34px 40px;box-shadow:10px 10px 0 #000;animation:${a("in-left", 0.45, 0.8)}">
          <div class="cap" style="font-size:52px">“connect your wallet<br>to claim 🎁”</div>
          <div style="margin-top:14px;font-size:28px;color:${C.faded};letter-spacing:.06em">random dm · link · “hurry”</div>
        </div>
        <div class="abs stamp" style="left:400px;top:570px;font-size:140px;--r:-12deg;animation:${a("slam", 0.45, 2.0)}">void</div>
        <div class="abs paper" style="left:90px;right:90px;top:870px;padding:34px 40px;box-shadow:10px 10px 0 #000;animation:${a("in-left", 0.45, 3.0)}">
          <div class="cap" style="font-size:52px">tokens sent to you.<br>receipt published.</div>
          <div style="margin-top:14px;font-size:28px;color:${C.faded};letter-spacing:.06em">no claim site · no wallet connect · no fees</div>
        </div>
        <div class="abs stamp" style="left:470px;top:1040px;font-size:104px;--r:-8deg;color:${C.ok};animation:${a("slam", 0.45, 4.2)}">ours</div>
        ${meme("giveaway rounds on X<br>every few hours", 1290, 5.2, 58)}
      </div>
      ${end(7.4, `token ${T} · launching on solana · giveaway on x`)}
    </div>`,
  },

  "s06-receipt-for-everything": {
    duration: 9.5,
    poster: 5.2,
    html: `<div class="f dark">
      <div style="${hide(6.9)}">
        ${meme("deleted tweet?", 300, 0.2, 86)}
        <div class="abs stamp" style="left:180px;top:440px;font-size:120px;--r:-10deg;animation:${a("slam", 0.4, 0.8)}">receipt</div>
        ${meme("“dev went for<br>a walk”?", 680, 1.8, 76)}
        <div class="abs stamp" style="left:200px;top:900px;font-size:120px;--r:8deg;animation:${a("slam", 0.4, 2.4)}">receipt</div>
        ${meme("“partnership<br>soon”?", 1100, 3.4, 76)}
        <div class="abs stamp" style="left:180px;top:1290px;font-size:120px;--r:-6deg;animation:${a("slam", 0.4, 4.0)}">receipt</div>
      </div>
      ${end(6.9)}
    </div>`,
  },
};

const pick = process.argv.slice(2);
for (const [name, v] of Object.entries(SHORTS)) if (!pick.length || pick.includes(name)) await render(name, { ...v, w: W, h: H, out: OUT });
await close();
