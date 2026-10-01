// RECEIPT — the $RCPT mascot. One source for every pose: website, avatars, token image, memes.
// Plain JS, no dependencies: every function returns an SVG string.
// Canvas for a full character: 400 × 600 (viewBox "0 0 400 600").

export const INK = "#1b1a17";
export const PAPER = "#f4f0e6";
export const PAPER_BACK = "#e6dfcf";
export const FADED = "#9a958a";
export const STAMP = "#d8332a";
export const MARKER = "#f6e05e";

const SW = 7; // outline width

// Zig-zag (serrated tear) from x0 to x1 at y, teeth pointing down.
function zigzag(x0, x1, y, teeth, depth) {
  const step = (x1 - x0) / teeth;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = x0 + step * i;
    d += ` L${(a + step / 2).toFixed(1)},${y + depth} L${(a + step).toFixed(1)},${y}`;
  }
  return d;
}

// Paper body: rolled top, slightly bent sides, serrated bottom.
export function body({ x = 108, y = 100, w = 184, h = 370, teeth = 9, depth = 15 } = {}) {
  const r = x + w;
  const b = y + h;
  const path =
    `M${x},${y}` +
    ` C${x - 6},${y + h * 0.33} ${x + 7},${y + h * 0.66} ${x - 2},${b}` +
    zigzag(x - 2, r + 2, b, teeth, depth) +
    ` C${r + 6},${y + h * 0.62} ${r - 6},${y + h * 0.3} ${r},${y} Z`;
  // soft bend shading (paper is never flat)
  const bend =
    `M${x + w * 0.62},${y + 8} C${x + w * 0.52},${y + h * 0.4} ${x + w * 0.72},${y + h * 0.7} ${x + w * 0.6},${b - 4}` +
    ` L${r - 6},${b - 4} C${r + 2},${y + h * 0.62} ${r - 8},${y + h * 0.3} ${r - 4},${y + 8} Z`;
  // the curl: paper rolling back at the top
  const curl = `<rect x="${x - 6}" y="${y - 30}" width="${w + 12}" height="44" rx="22" fill="${PAPER_BACK}" stroke="${INK}" stroke-width="${SW}"/>
  <path d="M${x + 30},${y - 8} H${r - 14}" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".35"/>
  <path d="M${x + 16},${y - 8} m-9,0 a9,9 0 1,1 9,9 a5,5 0 1,1 -5,-5" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
  return `<path d="${path}" fill="${PAPER}"/>
  <path d="${bend}" fill="${PAPER_BACK}" opacity=".55"/>
  <path d="${path}" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
  ${curl}`;
}

// Printed lines under the face: rule, items with dot leaders, total, barcode.
export function printout({ x = 108, y = 100, w = 184, lines = true, barcode = true } = {}) {
  let s = "";
  const l = x + 22;
  const r = x + w - 22;
  if (lines) {
    s += `<path d="M${l},${y + 186} H${r}" stroke="${INK}" stroke-width="3" stroke-dasharray="7 6" opacity=".55"/>`;
    const rows = [
      [62, 26],
      [44, 34],
      [70, 22],
    ];
    rows.forEach(([a, b], i) => {
      const yy = y + 210 + i * 22;
      s += `<rect x="${l}" y="${yy - 4}" width="${a}" height="8" rx="2" fill="${FADED}"/>`;
      s += `<path d="M${l + a + 6},${yy + 2} H${r - b - 6}" stroke="${FADED}" stroke-width="3" stroke-dasharray="1 5" stroke-linecap="round"/>`;
      s += `<rect x="${r - b}" y="${yy - 4}" width="${b}" height="8" rx="2" fill="${FADED}"/>`;
    });
    s += `<rect x="${l}" y="${y + 274}" width="58" height="11" rx="2" fill="${INK}"/>`;
    s += `<rect x="${r - 40}" y="${y + 274}" width="40" height="11" rx="2" fill="${INK}"/>`;
  }
  if (barcode) {
    const bars = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2, 3];
    let bx = l + 4;
    const by = y + 300;
    bars.forEach((bw, i) => {
      if (i % 2 === 0) s += `<rect x="${bx.toFixed(1)}" y="${by}" width="${(bw * 2).toFixed(1)}" height="32" fill="${INK}"/>`;
      bx += bw * 2 + (i % 2 ? 0 : 0.6);
    });
  }
  return s;
}

// Faces. Eyes sit around y = 205.
export function face(expr = "skeptic", { cx = 200, cy = 205 } = {}) {
  const lx = cx - 36;
  const rx = cx + 36;
  // class="eye" lets the website blink them with CSS; ignored in PNG renders
  const eye = (x, y, sx = 13, sy = 19) => `<ellipse class="eye" cx="${x}" cy="${y}" rx="${sx}" ry="${sy}" fill="${INK}"/>`;
  const line = (d, w = 7) => `<path d="${d}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  switch (expr) {
    case "neutral":
      return eye(lx, cy) + eye(rx, cy) + line(`M${cx - 18},${cy + 48} H${cx + 18}`);
    case "skeptic": // the signature look: one brow up — "receipt?"
      return (
        eye(lx, cy + 2, 13, 16) +
        eye(rx, cy, 13, 19) +
        line(`M${lx - 22},${cy - 26} L${lx + 18},${cy - 24}`) +
        line(`M${rx - 18},${cy - 34} Q${rx + 2},${cy - 46} ${rx + 22},${cy - 38}`) +
        line(`M${cx - 20},${cy + 50} Q${cx + 2},${cy + 46} ${cx + 22},${cy + 42}`)
      );
    case "happy":
      return (
        line(`M${lx - 15},${cy + 4} Q${lx},${cy - 16} ${lx + 15},${cy + 4}`, 8) +
        line(`M${rx - 15},${cy + 4} Q${rx},${cy - 16} ${rx + 15},${cy + 4}`, 8) +
        `<path d="M${cx - 26},${cy + 36} Q${cx},${cy + 66} ${cx + 26},${cy + 36} Z" fill="${INK}"/>`
      );
    case "shock":
      return (
        `<ellipse cx="${lx}" cy="${cy}" rx="17" ry="22" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>` +
        `<ellipse cx="${rx}" cy="${cy}" rx="17" ry="22" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>` +
        eye(lx, cy + 3, 6, 8) +
        eye(rx, cy + 3, 6, 8) +
        line(`M${lx - 18},${cy - 38} L${lx + 14},${cy - 44}`) +
        line(`M${rx - 14},${cy - 44} L${rx + 18},${cy - 38}`) +
        `<ellipse cx="${cx}" cy="${cy + 56}" rx="13" ry="17" fill="${INK}"/>`
      );
    case "angry":
      return (
        eye(lx, cy + 4, 13, 15) +
        eye(rx, cy + 4, 13, 15) +
        line(`M${lx - 20},${cy - 26} L${lx + 18},${cy - 14}`) +
        line(`M${rx - 18},${cy - 14} L${rx + 20},${cy - 26}`) +
        line(`M${cx - 20},${cy + 50} Q${cx},${cy + 38} ${cx + 20},${cy + 50}`)
      );
    case "sleep":
      return (
        line(`M${lx - 15},${cy} Q${lx},${cy + 12} ${lx + 15},${cy}`, 7) +
        line(`M${rx - 15},${cy} Q${rx},${cy + 12} ${rx + 15},${cy}`, 7) +
        line(`M${cx - 10},${cy + 46} H${cx + 10}`)
      );
    case "wink":
      return (
        eye(lx, cy, 13, 19) +
        line(`M${rx - 16},${cy + 2} Q${rx},${cy - 12} ${rx + 16},${cy + 2}`, 8) +
        line(`M${cx - 22},${cy + 40} Q${cx},${cy + 58} ${cx + 22},${cy + 40}`)
      );
    default:
      return eye(lx, cy) + eye(rx, cy);
  }
}

// Legs with little shoes, drawn behind the paper.
export function legs({ y = 470, color = INK } = {}) {
  const leg = (x, dir) =>
    `<path d="M${x},${y - 10} L${x + dir * 6},${y + 66}" stroke="${color}" stroke-width="${SW}" stroke-linecap="round"/>` +
    `<ellipse cx="${x + dir * 18}" cy="${y + 72}" rx="24" ry="11" fill="${color}"/>`;
  return leg(166, -1) + leg(234, 1);
}

// Arms. Shoulders at (108, 300) and (292, 300). color = limb colour (paper on dark backgrounds).
export function arms(pose = "down", color = INK) {
  const hand = (x, y, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
  const limb = (d) => `<path d="${d}" stroke="${color}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  switch (pose) {
    case "point": // right arm points up-right
      return limb("M110,300 C86,340 80,370 84,400") + hand(84, 404) + limb("M290,300 C326,282 350,250 362,214") + hand(364, 210);
    case "wave":
      return limb("M110,300 C86,340 80,370 84,400") + hand(84, 404) + limb("M290,300 C330,286 346,246 344,200") + hand(344, 194);
    case "up": // both arms up (celebrate / panic)
      return limb("M110,300 C76,280 60,240 58,196") + hand(58, 190) + limb("M290,300 C324,280 340,240 342,196") + hand(342, 190);
    case "hold": // both hands forward at chest height, holding a prop
      return limb("M110,300 C130,350 160,370 186,372") + hand(188, 372) + limb("M290,300 C270,350 240,370 214,372") + hand(212, 372);
    case "hip":
      return limb("M110,300 C80,320 82,350 112,370") + hand(114, 372, 10) + limb("M290,300 C320,320 318,350 288,370") + hand(286, 372, 10);
    default:
      return limb("M110,300 C88,340 82,372 86,404") + hand(86, 408) + limb("M290,300 C312,340 318,372 314,404") + hand(314, 408);
  }
}

// Props
export function stampProp(x = 364, y = 210) {
  return `<g transform="translate(${x - 30} ${y - 80})">
    <rect x="18" y="0" width="24" height="44" rx="10" fill="${INK}"/>
    <rect x="4" y="40" width="52" height="16" rx="4" fill="${INK}"/>
    <rect x="0" y="54" width="60" height="14" rx="3" fill="${STAMP}" stroke="${INK}" stroke-width="5"/>
  </g>`;
}

export function magnifier(x = 364, y = 210) {
  return `<g transform="translate(${x} ${y})">
    <path d="M0,0 L-10,-34" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="-22" cy="-74" r="38" fill="#dff1f4" fill-opacity=".85" stroke="${INK}" stroke-width="8"/>
    <path d="M-44,-86 A26,26 0 0 1 -26,-102" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none"/>
  </g>`;
}

// A full character. opts: expr, arms, legs, prop, tilt, printout
export function character(opts = {}) {
  // dark: true → limbs, shoes and shadow in paper colour so they read on dark backgrounds
  const { expr = "skeptic", pose = "down", withLegs = true, prop = "", tilt = 0, lines = true, shadow = true, dark = false } = opts;
  const limbColor = dark ? PAPER : INK;
  const propSvg = prop === "stamp" ? stampProp() : prop === "magnifier" ? magnifier() : prop;
  return `<g transform="rotate(${tilt} 200 330)">
  ${shadow ? `<ellipse cx="200" cy="552" rx="120" ry="14" fill="${dark ? "#000" : INK}" opacity="${dark ? ".45" : ".14"}"/>` : ""}
  ${withLegs ? legs({ color: limbColor }) : ""}
  ${arms(pose, limbColor)}
  ${body()}
  ${printout({ lines })}
  ${face(expr)}
  ${propSvg}
</g>`;
}

export function svg(inner, { w = 400, h = 600, viewBox = "0 0 400 600", bg = "" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ""}${inner}</svg>`;
}

// Compact symbol (logo mark / favicon): paper slip + skeptical face, no limbs.
export function symbol({ bg = "", stroke = true } = {}) {
  // viewBox 0 0 100 100
  const p = "M27,18 C25.5,42 28.5,62 26.5,84 L31.6,90 L36.7,84 L41.8,90 L46.9,84 L52,90 L57.1,84 L62.2,90 L67.3,84 L73.5,84 C71.5,62 74.5,42 73,18 Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${bg ? `<rect width="100" height="100" rx="22" fill="${bg}"/>` : ""}
  <path d="${p}" fill="${PAPER}" ${stroke ? `stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"` : ""}/>
  <rect x="23.5" y="10" width="53" height="15" rx="7.5" fill="${PAPER_BACK}" stroke="${INK}" stroke-width="4.5"/>
  <ellipse cx="41" cy="45" rx="4.6" ry="6" fill="${INK}"/>
  <ellipse cx="59" cy="44" rx="4.6" ry="7" fill="${INK}"/>
  <path d="M33,35 L46,35.8" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M53,32 Q60,27 67,30" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
  <path d="M44,62 Q50,61 57,58.5" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
</svg>`;
}

// ── Villains ───────────────────────────────────────────────
// THE SHREDDER — eats evidence (deleted posts, wiped sites, vanished devs). viewBox 0 0 400 600.
export function shredder({ expr = "grin" } = {}) {
  const body = "#2b2a27";
  const steel = "#8d8a82";
  let strips = "";
  const xs = [128, 152, 176, 200, 224, 248, 272];
  xs.forEach((x, i) => {
    const len = 70 + ((i * 37) % 60);
    const sway = i % 2 ? 6 : -6;
    strips += `<path d="M${x},430 q${sway},${len / 2} 0,${len}" stroke="${PAPER}" stroke-width="16" fill="none"/>`;
    strips += `<path d="M${x},430 q${sway},${len / 2} 0,${len}" stroke="${INK}" stroke-width="16" fill="none" stroke-dasharray="2 ${len}" opacity=".0"/>`;
    strips += `<path d="M${x - 8},430 q${sway},${len / 2} 0,${len} M${x + 8},430 q${sway},${len / 2} 0,${len}" stroke="${INK}" stroke-width="3" fill="none"/>`;
  });
  const brows =
    expr === "grin"
      ? `<path d="M138,238 L186,256" stroke="${PAPER}" stroke-width="9" stroke-linecap="round"/><path d="M262,238 L214,256" stroke="${PAPER}" stroke-width="9" stroke-linecap="round"/>`
      : "";
  return `
  <ellipse cx="200" cy="560" rx="130" ry="14" fill="${INK}" opacity=".14"/>
  ${strips}
  <rect x="96" y="150" width="208" height="290" rx="26" fill="${body}" stroke="${INK}" stroke-width="7"/>
  <rect x="84" y="128" width="232" height="56" rx="16" fill="#3a3935" stroke="${INK}" stroke-width="7"/>
  <rect x="112" y="148" width="176" height="14" rx="7" fill="${INK}"/>
  <path d="M116,162 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-12" stroke="${steel}" stroke-width="4" fill="none" stroke-linejoin="round"/>
  <circle cx="290" cy="142" r="6" fill="${STAMP}"/>
  ${brows}
  <ellipse cx="160" cy="282" rx="22" ry="20" fill="${PAPER}"/><ellipse cx="240" cy="282" rx="22" ry="20" fill="${PAPER}"/>
  <circle cx="166" cy="286" r="9" fill="${INK}"/><circle cx="234" cy="286" r="9" fill="${INK}"/>
  <path d="M140,340 Q200,392 260,340 Z" fill="${INK}" stroke="${PAPER}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M152,346 l10,14 l10,-12 l10,14 l10,-12 l10,14 l10,-12 l10,14 l10,-12 l10,12" stroke="${PAPER}" stroke-width="4" fill="none" stroke-linejoin="round"/>
  <rect x="120" y="406" width="160" height="10" rx="5" fill="${INK}"/>`;
}

// THE COUPON — loud, shiny, always expiring ("100X OFF! TODAY ONLY!"). viewBox 0 0 400 600.
export function coupon({ text = "100X OFF!", sub = "TODAY ONLY" } = {}) {
  const gold = "#f2c84b";
  return `
  <ellipse cx="200" cy="556" rx="120" ry="14" fill="${INK}" opacity=".14"/>
  <path d="M168,470 L160,540 M232,470 L240,540" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="146" cy="546" rx="24" ry="11" fill="${INK}"/><ellipse cx="254" cy="546" rx="24" ry="11" fill="${INK}"/>
  <path d="M70,300 C40,270 30,240 44,210" stroke="${INK}" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="44" cy="204" r="11" fill="${INK}"/>
  <path d="M330,300 C364,282 372,250 358,222" stroke="${INK}" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="358" cy="216" r="11" fill="${INK}"/>
  <rect x="64" y="150" width="272" height="330" rx="18" fill="${gold}" stroke="${INK}" stroke-width="7"/>
  <rect x="82" y="168" width="236" height="294" rx="10" fill="none" stroke="${INK}" stroke-width="3.5" stroke-dasharray="12 8"/>
  <g transform="translate(300 150) rotate(90)"><circle cx="-6" cy="-6" r="7" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="-6" cy="10" r="7" fill="none" stroke="${INK}" stroke-width="3"/><path d="M0,-2 L18,10 M0,6 L18,-6" stroke="${INK}" stroke-width="3"/></g>
  <path d="M120,214 l6,-14 l6,14 l14,6 l-14,6 l-6,14 l-6,-14 l-14,-6 z" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
  <path d="M276,206 l4,-9 l4,9 l9,4 l-9,4 l-4,9 l-4,-9 l-9,-4 z" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
  <ellipse class="eye" cx="164" cy="250" rx="13" ry="17" fill="${INK}"/><ellipse class="eye" cx="236" cy="250" rx="13" ry="17" fill="${INK}"/>
  <circle cx="169" cy="244" r="4.5" fill="${PAPER}"/><circle cx="241" cy="244" r="4.5" fill="${PAPER}"/>
  <path d="M130,286 Q200,350 270,286 Q200,316 130,286 Z" fill="${PAPER}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M152,298 L156,312 M176,304 L178,320 M200,306 L200,322 M224,304 L222,320 M248,298 L244,312" stroke="${INK}" stroke-width="3"/>
  <text x="200" y="392" text-anchor="middle" font-family="Doto, monospace" font-weight="900" font-size="40" fill="${INK}">${text}</text>
  <text x="200" y="430" text-anchor="middle" font-family="'Martian Mono', monospace" font-weight="800" font-size="20" letter-spacing="3" fill="${STAMP}">${sub}</text>
  <text x="200" y="452" text-anchor="middle" font-family="'Martian Mono', monospace" font-size="9" fill="${INK}" opacity=".7">*terms: none of this is real</text>`;
}
