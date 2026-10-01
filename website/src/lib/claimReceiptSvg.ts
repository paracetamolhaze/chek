// Browser twin of server/lib/render.js → claimReceiptSvg (square format): the /print preview draws the same receipt the
// server renders to PNG — same blocks, sizes, steps and order — with the page's own fonts (CSS variables from next/font).
// Font metrics (advance / cap height in em) are the server's (server/fonts/fonts.json); the variable web fonts match them.
// All user text goes through esc(); the mascot and logo markup come from brand/mascot.mjs.
import { character, symbol, INK, PAPER, FADED, STAMP } from "../../../brand/mascot.mjs";
import { DISCLAIMER, STAMP_COPY, claimCode, normalize, type Stamp } from "../../../shared/claim.mjs";
import { code128 } from "@/components/Barcode";

type Face = { css: string; adv: number; cap: number };
const FAM_MONO = "var(--font-martian),'Martian Mono Cyrillic',ui-monospace,monospace";
const F = {
  doto: { css: "font-family:var(--font-doto),ui-monospace,monospace;font-weight:900", adv: 0.6, cap: 0.7 },
  mono: { css: `font-family:${FAM_MONO};font-weight:400;font-stretch:87.5%`, adv: 0.65, cap: 0.8 },
  bold: { css: `font-family:${FAM_MONO};font-weight:800;font-stretch:87.5%`, adv: 0.65, cap: 0.8 },
  wide: { css: `font-family:${FAM_MONO};font-weight:800;font-stretch:112.5%`, adv: 0.75, cap: 0.8 },
} satisfies Record<string, Face>;

// Doto glyph coverage (server/fonts/fonts.json): claims with other characters use wide Martian Mono, as on the server.
const DOTO = [
  [32, 126], [160, 163], [165, 165], [167, 171], [174, 176], [180, 180], [182, 184], [186, 187], [191, 263], [266, 275],
  [278, 283], [286, 291], [294, 295], [298, 299], [302, 305], [310, 311], [313, 318], [321, 328], [336, 341], [344, 347],
  [350, 353], [356, 357], [362, 363], [366, 382], [8211, 8212], [8216, 8218], [8220, 8222], [8226, 8226], [8230, 8230],
  [8249, 8250], [8364, 8364], [8482, 8482], [8722, 8722],
];
const dotoCovers = (s: string) => Array.from(s).every((c) => DOTO.some(([a, b]) => c.codePointAt(0)! >= a && c.codePointAt(0)! <= b));

const C = { ink: INK, paper: PAPER, faded: FADED, stamp: STAMP, counter: "#141311", fog: "#a7a193" };
const FOOTER = "RECEIPTS OR IT DIDN'T HAPPEN";
const SQUARE = { W: 1080, H: 1080, m: [64, 60, 100, 60], Wd: 620, max: 1.0, char: 450 };
const PAD_X = 46;
const PAD_Y = 36;
const TOOTH = 26;
const DEPTH = 13;

const r2 = (n: number) => Math.round(n * 100) / 100;
const len = (s: string) => Array.from(s).length;
const slice = (s: string, a: number, b?: number) => Array.from(s).slice(a, b).join("");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const upper = (s: string) => normalize(s.toUpperCase()).text;
const textW = (s: string, f: Face, size: number, ls = 0) => {
  const n = len(s);
  return n ? n * f.adv * size + (n - 1) * ls : 0;
};
const capacity = (w: number, f: Face, size: number, ls = 0) => Math.max(1, Math.floor((w + ls) / (f.adv * size + ls)));
const ellipsis = (s: string, max: number) => (len(s) + 1 > max ? slice(s, 0, max - 1) : s).trimEnd() + "…";

function wrap(str: string, max: number, maxLines = Infinity) {
  const out: string[] = [];
  for (const para of str.split("\n")) {
    let line = "";
    for (let word of para.split(" ")) {
      if (!word) continue;
      if (len(word) > max) {
        if (line) out.push(line);
        while (len(word) > max) {
          out.push(slice(word, 0, max));
          word = slice(word, max);
        }
        line = word;
      } else if (!line) line = word;
      else if (len(line) + 1 + len(word) <= max) line += " " + word;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  if (out.length <= maxLines) return out;
  const cut = out.slice(0, maxLines);
  cut[maxLines - 1] = ellipsis(cut[maxLines - 1], max);
  return cut;
}

type TextOpts = { fill?: string; ls?: number; anchor?: "start" | "middle" | "end"; opacity?: number };
function text(x: number, y: number, s: string, f: Face, size: number, o: TextOpts = {}) {
  if (!s) return "";
  const a = [`x="${r2(x)}"`, `y="${r2(y)}"`, `font-size="${r2(size)}"`, `fill="${o.fill ?? C.ink}"`];
  if (o.ls) a.push(`letter-spacing="${r2(o.ls)}"`);
  if (o.anchor && o.anchor !== "start") a.push(`text-anchor="${o.anchor}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<text ${a.join(" ")} style="${f.css};white-space:pre">${esc(s)}</text>`;
}
const base = (top: number, lh: number, f: Face, size: number) => top + lh / 2 + (f.cap * size) / 2;
const dots = (x1: number, x2: number, y: number, size: number, color = C.ink) =>
  x2 - x1 < size * 0.9
    ? ""
    : `<path d="M${r2(x1)},${r2(y)} H${r2(x2)}" stroke="${color}" stroke-width="${r2(size * 0.12)}" stroke-linecap="round" stroke-dasharray="0 ${r2(size * 0.36)}" opacity=".42"/>`;

function stampShape(str: string, size: number, inkId: string, rot = -9, maxChars = 10, opacity = 0.9) {
  const lines = wrap(str, maxChars, 2);
  const ls = size * 0.08;
  const cap = F.bold.cap * size;
  const lg = size * 0.36;
  const pad = size * 0.44;
  const tw = Math.max(...lines.map((l) => textW(l, F.bold, size, ls)));
  const iw = tw + size * 1.05;
  const ih = lines.length * cap + (lines.length - 1) * lg + 2 * pad;
  const border = Math.max(3.5, size * 0.15);
  const ring = border * 1.15;
  const ow = iw + 2 * (ring + border);
  const oh = ih + 2 * (ring + border);
  const a = (Math.abs(rot) * Math.PI) / 180;
  const draw = (cx: number, cy: number) => {
    const t = lines.map((l, i) => text(0, -ih / 2 + pad + cap * (i + 1) + lg * i, l, F.bold, size, { ls, anchor: "middle", fill: C.stamp })).join("");
    const o = ring + border / 2 + border / 4;
    return `<g transform="translate(${r2(cx)} ${r2(cy)}) rotate(${rot})" opacity="${opacity}" filter="url(#${inkId})" style="mix-blend-mode:multiply">
      <rect x="${r2(-iw / 2)}" y="${r2(-ih / 2)}" width="${r2(iw)}" height="${r2(ih)}" rx="${r2(size * 0.12)}" fill="none" stroke="${C.stamp}" stroke-width="${r2(border)}"/>
      <rect x="${r2(-iw / 2 - o)}" y="${r2(-ih / 2 - o)}" width="${r2(iw + 2 * o)}" height="${r2(ih + 2 * o)}" rx="${r2(size * 0.2)}" fill="none" stroke="${C.stamp}" stroke-width="${r2(border / 2)}"/>
      ${t}</g>`;
  };
  return { bw: ow * Math.cos(a) + oh * Math.sin(a), bh: ow * Math.sin(a) + oh * Math.cos(a), draw };
}

function paperPath(w: number, h: number) {
  const n = Math.max(4, Math.round(w / TOOTH));
  const step = w / n;
  let d = `M0,${DEPTH}`;
  for (let i = 0; i < n; i++) d += ` L${r2(step * i + step / 2)},0 L${r2(step * (i + 1))},${DEPTH}`;
  d += ` V${r2(h - DEPTH)}`;
  for (let i = n; i > 0; i--) d += ` L${r2(step * i - step / 2)},${r2(h)} L${r2(step * (i - 1))},${r2(h - DEPTH)}`;
  return `${d} Z`;
}

// ── Blocks: builder(w) → { h, draw(x, y) } in paper units ──
type Block = { h: number; draw: (x: number, y: number) => string };
type Builder = (w: number) => Block;
const block = (h: number, draw: Block["draw"] = () => ""): Block => ({ h, draw });
const gap = (h: number): Builder => () => block(h);
const rule = (h = 30): Builder => (w) =>
  block(h, (x, y) => `<path d="M${r2(x)},${r2(y + h / 2)} H${r2(x + w)}" stroke="${C.ink}" stroke-width="3" stroke-dasharray="12 10" opacity=".42"/>`);

type LineStyle = { f: Face; size: number; lh?: number; ls?: number; align?: "start" | "middle" | "end"; fill?: string; maxLines?: number };
function linesBlock(arr: string[], st: LineStyle, w: number) {
  const { f, size, lh = size * 1.4, ls = 0, align = "start", fill } = st;
  const ax = (x: number) => (align === "middle" ? x + w / 2 : align === "end" ? x + w : x);
  return block(arr.length * lh, (x, y) => arr.map((s, i) => text(ax(x), base(y + i * lh, lh, f, size), s, f, size, { ls, anchor: align, fill })).join(""));
}
const para = (str: string, st: LineStyle): Builder => (w) => linesBlock(str ? wrap(str, capacity(w, st.f, st.size, st.ls), st.maxLines) : [], st, w);

const QUOTE_STEPS: [keyof typeof F, number][] = [
  ["doto", 62],
  ["doto", 54],
  ["doto", 46],
  ["doto", 41],
  ["doto", 36],
  ["wide", 30],
  ["wide", 27],
  ["bold", 26],
  ["bold", 24],
  ["bold", 22],
  ["bold", 20],
];
const quote = (str: string, budget: number): Builder => (w) => {
  const steps = QUOTE_STEPS.filter(([k]) => k !== "doto" || dotoCovers(str));
  const longest = Math.max(...str.split(" ").map(len));
  for (const [i, [k, s0]] of steps.entries()) {
    const f = F[k];
    const size = k === "doto" ? s0 * 1.12 : s0;
    const ls = k === "wide" ? -size * 0.02 : 0;
    const lh = size * (k === "doto" ? 1.02 : 1.2);
    let max = capacity(w, f, size, ls);
    const last = i === steps.length - 1;
    const lines = wrap(str, max);
    if (!last && (lines.length * lh > budget || longest > max)) continue;
    while (max > longest && wrap(str, max - 1).length === lines.length) max--;
    return linesBlock(wrap(str, max, last ? Math.max(1, Math.floor(budget / lh)) : Infinity), { f, size, ls, lh }, w);
  }
  return block(0);
};

type Item = [string, string, string?];
const rows = (items: Item[], size: number): Builder => (w) => {
  const ls = size * 0.04;
  const lh = size * 1.34;
  const itemGap = size * 0.42;
  const max = capacity(w, F.mono, size, ls);
  const cw = F.mono.adv * size + ls;
  const out: { l?: string; v?: string; tone?: string; gapBefore?: boolean }[] = [];
  for (const [label, value, tone] of items) {
    const first = out.length;
    const vC = len(value || "");
    if (!value) wrap(label, max).forEach((l) => out.push({ l }));
    else if (len(label) + 3 + vC <= max) out.push({ l: label, v: value });
    else if (vC <= Math.floor(max * 0.58)) {
      const ll = label ? wrap(label, Math.max(4, max - vC - 2)) : [""];
      ll.forEach((l, i) => out.push({ l, v: i === ll.length - 1 ? value : "" }));
    } else {
      if (label) wrap(label, max).forEach((l) => out.push({ l }));
      wrap(value, max - 2).forEach((v) => out.push({ v }));
    }
    out.slice(first).forEach((o) => (o.tone = tone));
    if (first) out[first].gapBefore = true;
  }
  const h = out.length * lh + out.filter((o) => o.gapBefore).length * itemGap;
  return block(h, (x, y) => {
    let s = "";
    let yy = y;
    for (const o of out) {
      if (o.gapBefore) yy += itemGap;
      const by = base(yy, lh, F.mono, size);
      const lw = textW(o.l || "", F.mono, size, ls);
      const vw = textW(o.v || "", F.bold, size, ls);
      s += text(x, by, o.l || "", F.mono, size, { ls });
      if (o.v) s += text(x + w, by, o.v, F.bold, size, { ls, anchor: "end", fill: o.tone === "bad" ? C.stamp : C.ink });
      if (o.v) s += dots(x + (lw ? lw + cw * 0.7 : cw), x + w - vw - cw * 0.7, by - size * 0.06, size);
      yy += lh;
    }
    return s;
  });
};
const claimRows = (items: Item[]): Builder => (w) => {
  const fits = (s: number) => items.every(([l, v]) => len(l) + 3 + len(v) <= capacity(w, F.mono, s, s * 0.04));
  return rows(items, [23, 22, 21, 20].find(fits) ?? 23)(w);
};

// Date on the left, the rubber stamp on the right (or under it when there's no room).
const meta = (date: string, stampText: string, inkId: string, over = 26): Builder => (w) => {
  const lh = 31;
  const size = 19;
  const ls = size * 0.04;
  const leftW = textW(date, F.mono, size, ls);
  const leftH = lh;
  const room = w + over - leftW - 18;
  const shapes = [30, 27, 24].map((s) => stampShape(stampText, s, inkId));
  const st = shapes.find((sh) => sh.bw <= room) ?? shapes[0];
  let h: number;
  let sx: number;
  let sy: number;
  let top = 0;
  if (st.bw <= room) {
    h = Math.max(leftH, st.bh - 8);
    top = (h - leftH) / 2;
    sx = w + over - st.bw / 2;
    sy = h / 2;
  } else {
    h = leftH + 8 + st.bh;
    sx = Math.max(st.bw / 2, w + over - st.bw / 2);
    sy = leftH + 8 + st.bh / 2;
  }
  return block(h, (x, y) => text(x, base(y + top, lh, F.mono, size), date, F.mono, size, { ls }) + st.draw(x + sx, y + sy));
};

const barcode = (data: string): Builder => (w) => {
  const bars = code128(data);
  const modules = bars.reduce((a, b) => a + b, 0);
  const bw = Math.min(w * 0.8, modules * 3);
  const m = bw / modules;
  const bh = 62;
  return block(bh + 34, (x, y) => {
    let s = "";
    let cx = x + (w - bw) / 2;
    bars.forEach((n, i) => {
      if (i % 2 === 0) s += `<rect x="${r2(cx)}" y="${r2(y)}" width="${r2(n * m)}" height="${bh}"/>`;
      cx += n * m;
    });
    return `<g fill="${C.ink}">${s}</g>` + text(x + w / 2, y + bh + 26, data, F.mono, 15, { ls: 15 * 0.3, anchor: "middle" });
  });
};

function stack(builders: Builder[], w: number) {
  const bs = builders.map((b) => b(w));
  return {
    h: bs.reduce((a, b) => a + b.h, 0),
    draw: (x: number, y: number) => bs.map((b) => ((y += b.h), b.draw(x, y - b.h))).join(""),
  };
}

export type ClaimReceiptSpec = {
  claim: string;
  name?: string;
  stamp: Stamp;
  /** printed date text, e.g. printDate(); empty before the page knows the visitor's clock */
  date: string;
  /** site host and X handle for the tag under the paper */
  host: string;
  handle: string;
  /** unique prefix for the SVG ids (several previews may share a page) */
  idPrefix: string;
};

export function claimReceiptSvg(spec: ClaimReceiptSpec) {
  const L = SQUARE;
  const ids = { grid: `${spec.idPrefix}-grid`, vig: `${spec.idPrefix}-vig`, paper: `${spec.idPrefix}-paper`, ink: `${spec.idPrefix}-ink` };
  const code = claimCode(spec.claim);
  const copy = STAMP_COPY[spec.stamp] ?? STAMP_COPY.UNVERIFIED;
  const quoted = `“${upper(spec.claim)}”`;
  const items: Item[] = [...(spec.name ? [["CLAIMED BY", upper(spec.name)] as Item] : []), ["PROOF", copy.proof], ["STATUS", spec.stamp, "bad"]];
  const builders: Builder[] = [
    para("CHEK", { f: F.doto, size: 84, lh: 80, align: "middle" }),
    gap(10),
    para("CLAIM CHECK · SELF-SERVICE", { f: F.mono, size: 16, ls: 16 * 0.25, lh: 26, align: "middle", fill: C.faded, maxLines: 1 }),
    para(`RECEIPT ${code}`, { f: F.bold, size: 21, ls: 21 * 0.12, lh: 32, align: "middle", maxLines: 1 }),
    rule(),
    quote(quoted, 250),
    rule(),
    claimRows(items),
    rule(),
    meta(spec.date, spec.stamp, ids.ink),
    gap(16),
    barcode(code),
    gap(10),
    para(FOOTER, { f: F.bold, size: 16, ls: 16 * 0.16, lh: 24, align: "middle", maxLines: 2 }),
    para(DISCLAIMER, { f: F.mono, size: 14, ls: 14 * 0.06, lh: 22, align: "middle", fill: C.faded, maxLines: 1 }),
  ];

  // stage: paper scaled into the square beside Chek, widened while that prints the content larger
  const overlap = 0.26;
  const [mt, mr, mb, ml] = L.m;
  const side = ((L.char * 2) / 3) * (1 - overlap);
  const boxW = L.W - ml - mr - side;
  const boxH = L.H - mt - mb;
  let fit: { Wd: number; body: ReturnType<typeof stack>; contentH: number; s: number } | null = null;
  for (let k = 1; k <= 1.81; k += 0.1) {
    const Wd = Math.round(L.Wd * k);
    const body = stack(builders, Wd - 2 * PAD_X);
    const contentH = body.h + 2 * (DEPTH + PAD_Y);
    const sc = Math.min(boxW / Wd, boxH / contentH, L.max);
    if (!fit || sc > fit.s + 0.01) fit = { Wd, body, contentH, s: sc };
    if (sc < boxH / contentH) break;
  }
  const { Wd, body, contentH: Hp, s } = fit!;
  const pw = Wd * s;
  const ph = Hp * s;
  const px = ml + (L.W - ml - mr - (pw + side)) / 2;
  const py = mt + (boxH - ph) / 2;
  const cx = px + pw / 2;
  const cy = py + ph / 2;
  const T = (dy = 0) => `translate(${r2(cx)} ${r2(cy + dy)}) rotate(-1) scale(${r2(s * 1e4) / 1e4}) translate(${r2(-Wd / 2)} ${r2(-Hp / 2)})`;
  const path = paperPath(Wd, Hp);

  const ch = Math.min(L.char, Math.max(ph, 300) * 0.92);
  const chW = (ch * 2) / 3;
  const chX = px + pw - chW * overlap;
  const chY = Math.min(py + ph - ch * 0.86, L.H - 18 - ch * 0.95);
  const chek = character({ ...copy.mood, prop: copy.mood.prop ?? "", dark: true });

  // site tag: CHEK mark + host + X handle
  const tagY = Math.min(L.H - 34, py + ph + 64);
  const tag = [spec.host, spec.handle].filter(Boolean).join("  ·  ");
  const mk = 34;
  const tx0 = L.W / 2 - (mk + 12 + textW(tag, F.bold, 20, 4)) / 2;
  const mark = symbol({ stroke: false }).replace("<svg ", `<svg x="${r2(tx0)}" y="${r2(tagY - (F.bold.cap * 20) / 2 - mk / 2)}" width="${mk}" height="${mk}" `);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" role="img" aria-label="${esc(`Receipt preview: ${quoted}, ${spec.stamp}`)}">
<defs>
  <pattern id="${ids.grid}" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="1.5" fill="${C.paper}" fill-opacity=".07"/></pattern>
  <radialGradient id="${ids.vig}" cx=".5" cy=".45" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
  <linearGradient id="${ids.paper}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#e9e3d5"/><stop offset=".07" stop-color="${C.paper}"/><stop offset=".9" stop-color="${C.paper}"/><stop offset="1" stop-color="#e9e3d5"/></linearGradient>
  <filter id="${ids.ink}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="1" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.55" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in"/>
  </filter>
</defs>
<rect width="${L.W}" height="${L.H}" fill="${C.counter}"/>
<rect width="${L.W}" height="${L.H}" fill="url(#${ids.grid})"/>
<rect width="${L.W}" height="${L.H}" fill="url(#${ids.vig})"/>
<g transform="translate(${r2(chX)} ${r2(chY)}) scale(${r2((ch / 600) * 1e4) / 1e4})">${chek}</g>
<g transform="${T(16)}" fill="#000" stroke="#000" stroke-linejoin="round">${[54, 38, 24, 12].map((sw) => `<path d="${path}" stroke-width="${r2(sw / s)}" opacity=".13"/>`).join("")}</g>
<g transform="${T(3)}"><path d="${path}" fill="#000" opacity=".35"/></g>
<g transform="${T()}"><path d="${path}" fill="url(#${ids.paper})"/>${body.draw(PAD_X, DEPTH + PAD_Y)}</g>
${tag ? mark + text(tx0 + mk + 12, tagY, tag, F.bold, 20, { ls: 4, fill: C.fog, opacity: 0.85 }) : ""}
</svg>`;
}
