// "receipt?" reaction loop → content/animations/receipt-reaction.{gif,mp4}. Needs ffmpeg on PATH.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../brand/mascot.mjs";
import { close, shoot } from "./lib/render.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TMP = join(ROOT, ".preview/gif");
const OUT = join(ROOT, "content/animations");
const S = 600;
const frame = (expr, { blink = false, bubble = false } = {}) => `
  <div style="position:relative;width:${S}px;height:${S}px;background:${M.MARKER}">
    <div style="position:absolute;left:170px;top:120px;width:300px;height:450px">${M.svg(M.character({ expr, pose: "hip" }), { w: "100%", h: "100%" })}</div>
    ${bubble ? `<div style="position:absolute;left:60px;top:40px;background:${M.PAPER};font:800 52px 'Martian Mono';padding:.3em .55em;box-shadow:6px 6px 0 #000;transform:rotate(-4deg)">receipt?</div>` : ""}
  </div>`;
const frames = [
  ["a", frame("neutral"), 0.7],
  ["b", frame("skeptic"), 0.25],
  ["c", frame("skeptic", { bubble: true }), 1.1],
  ["d", frame("skeptic", { bubble: true, blink: true }), 0.12],
  ["e", frame("skeptic", { bubble: true }), 1.0],
];
const blinkCss = ".eye{transform:scaleY(.12);transform-box:fill-box;transform-origin:center}";
for (const [k, html] of frames) await shoot({ out: join(TMP, `${k}.png`), size: [S, S], html, css: k === "d" ? blinkCss : "" });
await close();
writeFileSync(join(TMP, "list.txt"), frames.map(([k, , d]) => `file '${k}.png'\nduration ${d}`).join("\n") + `\nfile '${frames.at(-1)[0]}.png'\n`);
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-threads", "3", ...args], { cwd: TMP });
ff(["-f", "concat", "-safe", "0", "-i", "list.txt", "-vf", "fps=25,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse", "-loop", "0", join(OUT, "receipt-reaction.gif")]);
ff(["-f", "concat", "-safe", "0", "-i", "list.txt", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-movflags", "+faststart", join(OUT, "receipt-reaction.mp4")]);
console.log("content/animations/receipt-reaction.gif + .mp4");
