// Prebuild: writes every mascot variant as a standalone SVG to public/m/ (generated, not committed).
// Each file carries its own blink animation, so <img> tags keep the eyes alive.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { character, shredder, coupon } from "../../brand/mascot.mjs";

const OUT = fileURLToPath(new URL("../public/m", import.meta.url));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const STYLE =
  "<style>.eye{transform-box:fill-box;transform-origin:center;animation:b 5.5s infinite}" +
  "@keyframes b{0%,46%,50%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}}" +
  "@media (prefers-reduced-motion:reduce){.eye{animation:none}}</style>";
const file = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">${STYLE}${inner}</svg>`;

const EXPR = ["neutral", "skeptic", "happy", "shock", "angry", "sleep", "wink"];
const POSE = ["down", "point", "wave", "up", "hold", "hip"];
let n = 0;
for (const expr of EXPR)
  for (const pose of POSE)
    for (const dark of [false, true])
      for (const prop of pose === "point" ? ["", "stamp", "magnifier"] : [""]) {
        const key = [expr, pose, prop, dark ? "dark" : ""].filter(Boolean).join("-");
        writeFileSync(join(OUT, `${key}.svg`), file(character({ expr, pose, prop, dark })));
        n++;
      }
writeFileSync(join(OUT, "shredder.svg"), file(shredder()));
writeFileSync(join(OUT, "coupon.svg"), file(coupon()));
console.log(`mascots: ${n + 2} svg → public/m`);
