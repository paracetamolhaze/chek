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
export function legs({ y = 470 } = {}) {
  const leg = (x, dir) =>
    `<path d="M${x},${y - 10} L${x + dir * 6},${y + 66}" stroke="${INK}" stroke-width="${SW}" stroke-linecap="round"/>` +
    `<ellipse cx="${x + dir * 18}" cy="${y + 72}" rx="24" ry="11" fill="${INK}"/>`;
  return leg(166, -1) + leg(234, 1);
}

const hand = (x, y, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;
const limb = (d) => `<path d="${d}" stroke="${INK}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

// Arms. Shoulders at (108, 300) and (292, 300).
export function arms(pose = "down") {
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
  const { expr = "skeptic", pose = "down", withLegs = true, prop = "", tilt = 0, lines = true, shadow = true } = opts;
  const propSvg = prop === "stamp" ? stampProp() : prop === "magnifier" ? magnifier() : prop;
  return `<g transform="rotate(${tilt} 200 330)">
  ${shadow ? `<ellipse cx="200" cy="552" rx="120" ry="14" fill="${INK}" opacity=".14"/>` : ""}
  ${withLegs ? legs() : ""}
  ${arms(pose)}
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
