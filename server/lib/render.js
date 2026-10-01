// RECEIPT RENDERER: receipt data → branded SVG → PNG. No browser: resvg + the static fonts in fonts/ (scripts/build-fonts.py).
//   renderReceipt(spec)      numbered project receipts (build log, on-chain events)
//   renderTextReceipt(spec)  the public Receipt Generator (user text, meme receipts)
// Visual language = brand/mascot.mjs + scripts/render-content.mjs: thermal paper with zig-zag tears, Doto display type,
// Martian Mono text, dashed rules, dot leaders, red double-border stamps, highlighter, dark counter with a dot grid.
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

// Brand art: a copy bundled with the deployment (data/mascot.mjs) or the repo source when run locally.
const M = existsSync(fileURLToPath(new URL("../data/mascot.mjs", import.meta.url)))
  ? await import("../data/mascot.mjs")
  : await import("../../brand/mascot.mjs");

// ── Fonts ─────────────────────────────────────────────────
const FONT_FILES = [
  fileURLToPath(new URL("../fonts/Doto-Black.ttf", import.meta.url)),
  fileURLToPath(new URL("../fonts/MartianMono-SemiCondensed.ttf", import.meta.url)),
  fileURLToPath(new URL("../fonts/MartianMono-SemiCondensedExtraBold.ttf", import.meta.url)),
  fileURLToPath(new URL("../fonts/MartianMono-SemiExpandedExtraBold.ttf", import.meta.url)),
];
const META = JSON.parse(readFileSync(new URL("../fonts/fonts.json", import.meta.url), "utf8")).faces;
const codepoints = (ranges) => {
  const s = new Set();
  for (const [a, b] of ranges) for (let c = a; c <= b; c++) s.add(c);
  return s;
};
// adv = advance width in em (monospace), cap = cap height in em (measured in resvg; centres capitals in a line box)
const face = (file, family, weight, stretch, cap) => ({ family, weight, stretch, cap, adv: META[file].advance, cps: codepoints(META[file].ranges) });
const F = {
  doto: face("Doto-Black.ttf", "Doto", 900, "normal", 0.7),
  mono: face("MartianMono-SemiCondensed.ttf", "Martian Mono", 400, "semi-condensed", 0.8),
  bold: face("MartianMono-SemiCondensedExtraBold.ttf", "Martian Mono", 800, "semi-condensed", 0.8),
  wide: face("MartianMono-SemiExpandedExtraBold.ttf", "Martian Mono", 800, "semi-expanded", 0.8),
};

const C = { ink: M.INK, paper: M.PAPER, faded: M.FADED, stamp: M.STAMP, marker: M.MARKER, counter: "#141311", fog: "#a7a193" };
const SITE = "chekcoin.vercel.app";
const FOOTER = "RECEIPTS OR IT DIDN'T HAPPEN";

// Canvas sizes. m = paper box margins [top, right, bottom, left]; Wd = paper design width (all type is set in these
// units, then the paper is scaled to fit); max = largest scale; char = character height; titleLines = lines a title may
// take before it shrinks. Story keeps clear of the app UI at the top and bottom.
const FORMATS = {
  square: { W: 1080, H: 1080, m: [64, 60, 100, 60], Wd: 620, cols: 1, max: 1.0, char: 450, titleLines: 3 },
  portrait: { W: 1080, H: 1350, m: [80, 60, 120, 60], Wd: 620, cols: 1, max: 1.12, char: 520, titleLines: 3 },
  story: { W: 1080, H: 1920, m: [230, 56, 330, 56], Wd: 530, cols: 1, max: 1.45, char: 560, titleLines: 4 },
  wide: { W: 1200, H: 675, m: [40, 44, 74, 44], Wd: 1040, cols: 2, max: 1.0, char: 430, titleLines: 3 },
};
export const FORMAT_NAMES = Object.keys(FORMATS);

const PAD_X = 46; // paper side padding
const PAD_Y = 36; // paper top/bottom padding (inside the teeth)
const TOOTH = 26; // zig-zag tooth width
const DEPTH = 13; // zig-zag tooth depth
const GUTTER = 60; // two-column (wide) gutter

// ── Text helpers ──────────────────────────────────────────
const r2 = (n) => Math.round(n * 100) / 100;
const len = (s) => Array.from(s).length;
const slice = (s, a, b) => Array.from(s).slice(a, b).join("");
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const covers = (f, s) => Array.from(s).every((c) => f.cps.has(c.codePointAt(0)));

// User text → printable: NFC, whitespace collapsed, anything the fonts can't draw (emoji, CJK…) dropped, length capped.
export function clean(s, { max = 200, multiline = false } = {}) {
  let t = String(s ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]/g, " ");
  t = Array.from(t)
    .filter((c) => (multiline && c === "\n") || F.mono.cps.has(c.codePointAt(0)))
    .join("");
  t = multiline
    ? t
        .split("\n")
        .map((l) => l.replace(/ +/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : t.replace(/\s+/g, " ").trim();
  return len(t) > max ? slice(t, 0, max - 1).trimEnd() + "…" : t;
}
const upper = (s, max) => clean(String(s ?? "").toUpperCase(), { max });

// Width of a monospace run: n advances plus letter-spacing between glyphs (resvg ignores the trailing one).
const textW = (s, f, size, ls = 0) => {
  const n = len(s);
  return n ? n * f.adv * size + (n - 1) * ls : 0;
};
// How many characters fit in w.
const capacity = (w, f, size, ls = 0) => Math.max(1, Math.floor((w + ls) / (f.adv * size + ls)));
const ellipsis = (s, max) => (len(s) + 1 > max ? slice(s, 0, max - 1) : s).trimEnd() + "…";

// Greedy word wrap for monospace text; words longer than a line are split. Overflow ends with "…".
export function wrap(str, max, maxLines = Infinity) {
  const out = [];
  for (const para of String(str).split("\n")) {
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

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
// "02 OCT 2026 · 14:05 UTC"
export function receiptDate(iso) {
  let d = new Date(iso ?? Date.now());
  if (Number.isNaN(d.getTime())) d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

// ── Code 128-B ────────────────────────────────────────────
// Element widths (bar, space, bar, space, bar, space) for values 0–105; 106 = stop (seven elements, ends on a bar).
const C128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
  "123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 " +
  "232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 " +
  "313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 " +
  "111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 " +
  "114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112"
).split(" ");
export const CODE128_PATTERNS = C128;

// Text (ASCII 32–126) → module widths, alternating bar/space, starting with a bar. Start B, data, checksum, stop.
export function code128(text) {
  const data = Array.from(String(text)).map((c) => {
    const v = c.charCodeAt(0) - 32;
    if (v < 0 || v > 94) throw new Error(`code128: unsupported character ${JSON.stringify(c)}`);
    return v;
  });
  const codes = [104, ...data];
  const check = codes.reduce((sum, v, i) => sum + v * (i || 1), 0) % 103;
  return [...codes, check, 106].flatMap((v) => Array.from(C128[v], Number));
}

// ── SVG primitives ────────────────────────────────────────
function text(x, y, s, f, size, o = {}) {
  if (!s) return "";
  const a = [`x="${r2(x)}"`, `y="${r2(y)}"`, `font-family="${f.family}"`, `font-weight="${f.weight}"`, `font-stretch="${f.stretch}"`, `font-size="${r2(size)}"`];
  a.push(`fill="${o.fill ?? C.ink}"`);
  if (o.ls) a.push(`letter-spacing="${r2(o.ls)}"`);
  if (o.anchor && o.anchor !== "start") a.push(`text-anchor="${o.anchor}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<text ${a.join(" ")} xml:space="preserve">${esc(s)}</text>`;
}
// Baseline that centres capitals in a line box.
const base = (top, lh, f, size) => top + lh / 2 + (f.cap * size) / 2;
const dots = (x1, x2, y, size, color = C.ink) =>
  x2 - x1 < size * 0.9
    ? ""
    : `<path d="M${r2(x1)},${r2(y)} H${r2(x2)}" stroke="${color}" stroke-width="${r2(size * 0.12)}" stroke-linecap="round" stroke-dasharray="0 ${r2(size * 0.36)}" opacity=".42"/>`;

// Rubber stamp: thick border + thin outer ring, rotated, ink texture. Returns its rotated box and a draw-at-centre.
function stampShape(str, { size = 30, color = C.stamp, rot = -9, maxChars = 10, opacity = 0.9 } = {}) {
  const lines = wrap(str, maxChars, 2);
  const ls = size * 0.08;
  const cap = F.bold.cap * size;
  const lg = size * 0.36;
  const pad = size * 0.44;
  const tw = Math.max(...lines.map((l) => textW(l, F.bold, size, ls)));
  const iw = tw + size * 1.05;
  const ih = lines.length * cap + (lines.length - 1) * lg + 2 * pad;
  const bw = Math.max(3.5, size * 0.15); // thick border
  const ring = bw * 1.15; // gap to the thin outer ring
  const ow = iw + 2 * (ring + bw);
  const oh = ih + 2 * (ring + bw);
  const a = (Math.abs(rot) * Math.PI) / 180;
  const box = { bw: ow * Math.cos(a) + oh * Math.sin(a), bh: ow * Math.sin(a) + oh * Math.cos(a) };
  const draw = (cx, cy) => {
    const t = lines.map((l, i) => text(0, -ih / 2 + pad + cap * (i + 1) + lg * i, l, F.bold, size, { ls, anchor: "middle", fill: color })).join("");
    const o = ring + bw / 2 + bw / 4;
    return `<g transform="translate(${r2(cx)} ${r2(cy)}) rotate(${rot})" opacity="${opacity}" filter="url(#ink)" style="mix-blend-mode:multiply">
      <rect x="${r2(-iw / 2)}" y="${r2(-ih / 2)}" width="${r2(iw)}" height="${r2(ih)}" rx="${r2(size * 0.12)}" fill="none" stroke="${color}" stroke-width="${r2(bw)}"/>
      <rect x="${r2(-iw / 2 - o)}" y="${r2(-ih / 2 - o)}" width="${r2(iw + 2 * o)}" height="${r2(ih + 2 * o)}" rx="${r2(size * 0.2)}" fill="none" stroke="${color}" stroke-width="${r2(bw / 2)}"/>
      ${t}</g>`;
  };
  return { ...box, draw };
}

// Paper outline: zig-zag tear top and bottom (bottom optional for the endless "long" receipt).
function paperPath(w, h, bottom = true) {
  const n = Math.max(4, Math.round(w / TOOTH));
  const step = w / n;
  let d = `M0,${DEPTH}`;
  for (let i = 0; i < n; i++) d += ` L${r2(step * i + step / 2)},0 L${r2(step * (i + 1))},${DEPTH}`;
  if (!bottom) return `${d} V${r2(h)} H0 Z`;
  d += ` V${r2(h - DEPTH)}`;
  for (let i = n; i > 0; i--) d += ` L${r2(step * i - step / 2)},${r2(h)} L${r2(step * (i - 1))},${r2(h - DEPTH)}`;
  return `${d} Z`;
}

// ── Layout blocks ─────────────────────────────────────────
// A block builder takes the column width and returns { h, draw(x, y) } in paper units.
const block = (h, draw = () => "") => ({ h, draw });
const gap = (h) => () => block(h);
const rule =
  (h = 30) =>
  (w) =>
    block(h, (x, y) => `<path d="M${r2(x)},${r2(y + h / 2)} H${r2(x + w)}" stroke="${C.ink}" stroke-width="3" stroke-dasharray="12 10" opacity=".42"/>`);

function linesBlock(arr, st, w) {
  const { f, size, lh = size * 1.4, ls = 0, align = "start", fill } = st;
  const ax = (x) => (align === "middle" ? x + w / 2 : align === "end" ? x + w : x);
  return block(arr.length * lh, (x, y) => arr.map((s, i) => text(ax(x), base(y + i * lh, lh, f, size), s, f, size, { ls, anchor: align, fill })).join(""));
}
const para = (str, st) => (w) => linesBlock(str ? wrap(str, capacity(w, st.f, st.size, st.ls), st.maxLines) : [], st, w);

// Big words (titles, headlines): Doto when it has every glyph, else wide Martian Mono. Steps the size down before it
// ever truncates; at the smallest size anything beyond maxLines ends with "…". Lines are balanced ("JOHN STILL /
// OWES ME $20", not "JOHN STILL OWES / ME $20").
const big =
  (str, { sizes, maxLines = 3, doto = false }) =>
  (w) => {
    const f = doto && covers(F.doto, str) ? F.doto : F.wide;
    const k = f === F.doto ? 1.12 : 1; // Doto is narrower: same visual weight a bit larger
    for (const [i, s0] of sizes.entries()) {
      const size = s0 * k;
      const ls = f === F.doto ? 0 : -size * 0.02;
      const last = i === sizes.length - 1;
      let max = capacity(w, f, size, ls);
      const longest = Math.max(...str.split(/\s+/).map(len));
      const lines = wrap(str, max, last ? maxLines : Infinity);
      if (!last && (lines.length > maxLines || longest > max)) continue; // smaller type before a split word
      while (max > longest && wrap(str, max - 1).length === lines.length) max--; // balance, never splitting a word
      return linesBlock(wrap(str, max, maxLines), { f, size, ls, lh: size * (f === F.doto ? 1.0 : 1.08) }, w);
    }
  };

// Receipt header: big CHEK, register line, receipt number. compact = one row (wide format).
function header(sub, no, compact) {
  if (compact)
    return [
      (w) =>
        block(70, (x, y) =>
          [
            text(x, base(y, 70, F.doto, 66), "CHEK", F.doto, 66),
            text(x + w, base(y + 6, 26, F.mono, 15), sub, F.mono, 15, { ls: 15 * 0.22, anchor: "end", fill: C.faded }),
            text(x + w, base(y + 34, 30, F.bold, 20), no, F.bold, 20, { ls: 2.4, anchor: "end" }),
          ].join(""),
        ),
    ];
  return [
    para("CHEK", { f: F.doto, size: 84, lh: 80, align: "middle" }),
    gap(10),
    para(sub, { f: F.mono, size: 16, ls: 16 * 0.25, lh: 26, align: "middle", fill: C.faded, maxLines: 1 }),
    para(no, { f: F.bold, size: 21, ls: 21 * 0.12, lh: 32, align: "middle", maxLines: 1 }),
  ];
}

// Item rows "LABEL ······ VALUE". Long labels wrap with the value on their last line; long values drop below.
// tone: "bad" = red value, "void" = struck through in stamp red.
const rows =
  (items, { size = 23 } = {}) =>
  (w) => {
    if (!items.length) return block(0);
    const ls = size * 0.04;
    const lh = size * 1.34;
    const itemGap = size * 0.42;
    const max = capacity(w, F.mono, size, ls);
    const cw = F.mono.adv * size + ls;
    const out = [];
    for (const [label, value, tone] of items) {
      const first = out.length;
      const vC = len(value || "");
      if (!value) wrap(label, max).forEach((l) => out.push({ l }));
      else if (len(label) + 3 + vC <= max) out.push({ l: label, v: value }); // room for a few leader dots
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
        s += text(x, by, o.l, F.mono, size, { ls });
        if (o.v) s += text(x + w, by, o.v, F.bold, size, { ls, anchor: "end", fill: o.tone === "bad" ? C.stamp : C.ink });
        if (o.v) s += dots(x + (lw ? lw + cw * 0.7 : cw), x + w - vw - cw * 0.7, by - size * 0.06, size);
        if (o.tone === "void" && (o.l || o.v)) {
          const sy = by - F.mono.cap * size * 0.42;
          const x1 = o.l ? x - 4 : x + w - vw - 4;
          s += `<path d="M${r2(x1)},${r2(sy + 1.5)} L${r2(x + w + 4)},${r2(sy - 1.5)}" stroke="${C.stamp}" stroke-width="${r2(size * 0.13)}" stroke-linecap="round" opacity=".85"/>`;
        }
        yy += lh;
      }
      return s;
    });
  };

// Total line: bold label, leaders, value in wide bold on a highlighter swipe (Doto's "." reads as "+": not for money).
const total =
  (label, value, { strike = false } = {}) =>
  (w) => {
    const lsize = 23;
    const lls = lsize * 0.06;
    const f = F.wide;
    const lw = textW(label, F.bold, lsize, lls);
    let size = 40;
    while (size > 16 && textW(value, f, size) > Math.min(w * 0.62, w - lw - 50)) size -= 2;
    const vw = textW(value, f, size);
    const h = size * 1.05 + 22;
    return block(h, (x, y) => {
      const by = y + h / 2 + (f.cap * size) / 2;
      const capH = f.cap * size;
      const mx = x + w - vw - 14;
      const my = by - capH - 10;
      const cw = F.bold.adv * lsize;
      let s = `<rect x="${r2(mx)}" y="${r2(my)}" width="${r2(vw + 24)}" height="${r2(capH + 20)}" rx="3" fill="${C.marker}" opacity=".95" transform="rotate(-1.2 ${r2(mx + vw / 2)} ${r2(my + capH / 2)})"/>`;
      s += text(x, by, label, F.bold, lsize, { ls: lls });
      s += dots(x + lw + cw * 0.7, mx - cw * 0.5, by - lsize * 0.06, lsize);
      s += text(x + w - 2, by, value, f, size, { anchor: "end" });
      if (strike) s += `<path d="M${r2(mx - 6)},${r2(by - capH * 0.42)} H${r2(x + w + 8)}" stroke="${C.stamp}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
      return s;
    });
  };

// One meta line: date, verification badge or a note. Returns its width and a draw-at-baseline.
function metaPart(e, w) {
  if (e.kind === "date") {
    const size = 19;
    const ls = size * 0.04;
    return { size, f: F.mono, w: textW(e.text, F.mono, size, ls), draw: (x, by) => text(x, by, e.text, F.mono, size, { ls }) };
  }
  if (e.kind === "onchain" || e.kind === "reported") {
    // Verified: solid ink box with a check, bold ink. Reported: dashed faded ring, light faded ink — never looks verified.
    const size = 16;
    const ls = size * 0.16;
    const label = e.kind === "onchain" ? "ON-CHAIN VERIFIED" : "PROJECT REPORTED";
    const f = e.kind === "onchain" ? F.bold : F.mono;
    const icon = 20;
    const w = icon + 11 + textW(label, f, size, ls);
    const draw = (x, by) => {
      const iy = by - (F.mono.cap * size) / 2 - icon / 2;
      const ic =
        e.kind === "onchain"
          ? `<rect x="${r2(x)}" y="${r2(iy)}" width="${icon}" height="${icon}" rx="3" fill="${C.ink}"/><path d="M${r2(x + 4.5)},${r2(iy + 10.5)} l4,4 l7,-8.5" stroke="${C.paper}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          : `<circle cx="${r2(x + icon / 2)}" cy="${r2(iy + icon / 2)}" r="${icon / 2 - 1.5}" fill="none" stroke="${C.faded}" stroke-width="2" stroke-dasharray="3 3"/>`;
      return ic + text(x + icon + 11, by, label, f, size, { ls, fill: e.kind === "onchain" ? C.ink : C.faded });
    };
    return { size, f, w, draw };
  }
  const size = 16;
  const ls = size * 0.1;
  const max = capacity(w, F.mono, size, ls);
  const t = len(e.text) > max ? ellipsis(e.text, max) : e.text;
  return { size, f: F.mono, w: textW(t, F.mono, size, ls), draw: (x, by) => text(x, by, t, F.mono, size, { ls, fill: e.fill ?? C.ink }) };
}

// Date / verification lines on the left, the rubber stamp on the right (or under them when there's no room).
const meta =
  (entries, stamp, over = 26) =>
  (w) => {
    const lh = 31;
    const parts = entries.map((e) => metaPart(e, w));
    const leftW = Math.max(0, ...parts.map((p) => p.w));
    const leftH = parts.length * lh;
    const room = w + over - leftW - 18; // over = how far a stamp may hang into the paper margin
    const shapes = stamp ? [30, 27, 24].map((size) => stampShape(stamp.text, { ...stamp, size })) : [];
    const st = shapes.find((sh) => sh.bw <= room) ?? shapes[0];
    let h = leftH;
    let sx = 0;
    let sy = 0;
    let top = 0;
    if (st && st.bw <= room) {
      h = Math.max(leftH, st.bh - 8);
      top = (h - leftH) / 2;
      sx = w + over - st.bw / 2;
      sy = h / 2;
    } else if (st) {
      h = leftH + 8 + st.bh;
      sx = Math.max(st.bw / 2, w + over - st.bw / 2);
      sy = leftH + 8 + st.bh / 2;
    }
    return block(h, (x, y) => {
      let s = parts.map((p, i) => p.draw(x, base(y + top + i * lh, lh, p.f, p.size))).join("");
      if (st) s += st.draw(x + sx, y + sy);
      return s;
    });
  };

const barcode = (data) => (w) => {
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

const footer = (str) => para(str, { f: F.bold, size: 16, ls: 16 * 0.16, lh: 24, align: "middle", maxLines: 2 });

// Faded "still printing" rows below the content of the endless receipt.
function ghostRows(x, y0, y1, w) {
  let s = "";
  for (let i = 0, y = y0; y < y1; i++, y += 34) {
    if (i % 7 === 6) {
      s += `<path d="M${x},${y + 4} H${x + w}" stroke="${C.ink}" stroke-width="3" stroke-dasharray="12 10" opacity=".2"/>`;
      continue;
    }
    const a = 60 + ((i * 53) % 150);
    const b = 34 + ((i * 29) % 40);
    s += `<rect x="${x}" y="${y}" width="${a}" height="9" rx="2" fill="${C.faded}" opacity=".5"/>`;
    s += `<rect x="${x + w - b}" y="${y}" width="${b}" height="9" rx="2" fill="${C.faded}" opacity=".5"/>`;
    s += dots(x + a + 12, x + w - b - 12, y + 5, 22, C.faded);
  }
  return s;
}

// Stack blocks: total height + draw.
function stack(builders, w) {
  const bs = builders.filter(Boolean).map((b) => b(w));
  return {
    h: bs.reduce((a, b) => a + b.h, 0),
    draw: (x, y) => bs.map((b) => ((y += b.h), b.draw(x, y - b.h))).join(""),
  };
}

// Paper content: one column (top, a, b, bottom), or two columns a | b between full-width top and bottom (wide).
function layout(c, Wd, cols) {
  const inner = Wd - 2 * PAD_X;
  if (cols === 1) {
    const s = stack([...c.top, ...c.a, ...c.b, ...c.bottom], inner);
    return { h: s.h, draw: (y) => s.draw(PAD_X, y) };
  }
  const colW = (inner - GUTTER) / 2;
  const top = stack(c.top, inner);
  const A = stack(c.a, colW);
  const B = stack(c.b, colW);
  const bot = stack(c.bottom, inner);
  const mid = Math.max(A.h, B.h);
  return {
    h: top.h + mid + bot.h,
    draw: (y) => {
      const my = y + top.h;
      const dx = PAD_X + colW + GUTTER / 2;
      return (
        top.draw(PAD_X, y) +
        A.draw(PAD_X, my + (mid - A.h) / 2) +
        `<path d="M${r2(dx)},${r2(my + 8)} V${r2(my + mid - 8)}" stroke="${C.ink}" stroke-width="3" stroke-dasharray="12 10" opacity=".25"/>` +
        B.draw(PAD_X + colW + GUTTER, my) +
        bot.draw(PAD_X, my + mid)
      );
    },
  };
}

// ── Characters ────────────────────────────────────────────
// Chek uses its dark-background variant; the villains get a paper sticker outline so their ink limbs read on the counter.
// overlap = share of the 400-wide art hidden behind the paper's right edge (up to the body outline).
function characterArt(kind, opts = {}) {
  if (kind === "shredder" || kind === "coupon") {
    const art = (kind === "shredder" ? M.shredder() : M.coupon()).replace(/<ellipse[^>]*opacity="\.14"\/>/, "");
    return {
      svg: `<ellipse cx="200" cy="558" rx="125" ry="14" fill="#000" opacity=".45"/><g filter="url(#sticker)">${art}</g>`,
      overlap: kind === "shredder" ? 0.21 : 0.16,
    };
  }
  return { svg: M.character({ expr: opts.expr ?? "skeptic", pose: opts.pose ?? "point", prop: opts.prop ?? "", dark: true }), overlap: 0.26 };
}

// ── Stage: counter background, paper, character, site tag ─
function defs(tint) {
  const [edge, mid] = tint === "aged" ? ["#ddd5c3", "#ece6d8"] : ["#e9e3d5", C.paper];
  return `<defs>
  <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="1.5" fill="${C.paper}" fill-opacity=".07"/></pattern>
  <radialGradient id="vignette" cx=".5" cy=".45" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
  <linearGradient id="paper" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${edge}"/><stop offset=".07" stop-color="${mid}"/><stop offset=".9" stop-color="${mid}"/><stop offset="1" stop-color="${edge}"/></linearGradient>
  <filter id="ink" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="1" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.55" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in"/>
  </filter>
  <filter id="sticker" x="-10%" y="-10%" width="120%" height="120%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="7" result="d"/>
    <feFlood flood-color="${C.paper}"/><feComposite in2="d" operator="in" result="o"/>
    <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>`;
}

function stage(content, fmt, { character = null, long = false, rot = -1, tint = "", overlay = null } = {}) {
  const L = FORMATS[fmt] ?? FORMATS.square;
  const cols = L.cols;
  const [mt, mr, mb, ml] = L.m;
  const side = character ? ((L.char * 2) / 3) * (1 - character.overlap) : 0; // visible part of the character beside the paper
  const boxW = L.W - ml - mr - side;
  const boxH = L.H - mt - mb;
  const top = long ? mt + 22 : mt; // the long receipt leaves room for the site tag above it
  const availH = long ? L.H - top - 64 : boxH;
  // Paper design width: the format default (the long receipt is a narrower strip), widened while that prints the
  // content larger — tall content wraps into fewer lines on wider paper. s = final scale = type size factor.
  const base = long && cols === 1 ? Math.round(L.Wd * 0.8) : L.Wd;
  let fit = null;
  for (let k = 1; k <= 1.81; k += 0.1) {
    const Wd = Math.round(base * k);
    const body = layout(content, Wd, cols);
    const contentH = body.h + 2 * (DEPTH + PAD_Y);
    const sc = Math.min(boxW / Wd, availH / contentH, L.max);
    if (!fit || sc > fit.s + 0.01) fit = { Wd, body, contentH, s: sc };
    if (sc < availH / contentH) break; // width-bound now: wider paper only gets smaller
  }
  const { Wd, body, contentH, s } = fit;
  const pw = Wd * s;
  const Hp = long ? (L.H - top) / s + 80 : contentH; // the long receipt runs off the bottom edge
  const ph = Hp * s;
  const px = ml + (L.W - ml - mr - (pw + side)) / 2;
  const py = long ? top : mt + (boxH - ph) / 2;
  const cx = px + pw / 2;
  const cy = py + ph / 2;
  const T = (dy = 0) => `translate(${r2(cx)} ${r2(cy + dy)}) rotate(${rot}) scale(${r2(s * 1e4) / 1e4}) translate(${r2(-Wd / 2)} ${r2(-Hp / 2)})`;
  const path = paperPath(Wd, Hp, !long);

  let charSvg = "";
  if (character) {
    const ch = Math.min(L.char, Math.max(ph, 300) * 0.92);
    const cw = (ch * 2) / 3;
    const x = px + pw - cw * character.overlap;
    const y = long ? L.H - 26 - ch * 0.95 : Math.min(py + ph - ch * 0.86, L.H - 18 - ch * 0.95);
    charSvg = `<g transform="translate(${r2(x)} ${r2(y)}) scale(${r2((ch / 600) * 1e4) / 1e4})">${character.svg}</g>`;
  }

  const inner = body.draw(DEPTH + PAD_Y);
  const ghost = long ? ghostRows(PAD_X, DEPTH + PAD_Y + body.h + 30, Hp, Wd - 2 * PAD_X) : "";
  const tagY = long ? top - 26 : Math.min(L.H - 34, py + ph + 64);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}">
${defs(tint)}
<rect width="${L.W}" height="${L.H}" fill="${C.counter}"/>
<rect width="${L.W}" height="${L.H}" fill="url(#grid)"/>
<rect width="${L.W}" height="${L.H}" fill="url(#vignette)"/>
${charSvg}
<g transform="${T(16)}" fill="#000" stroke="#000" stroke-linejoin="round">${[54, 38, 24, 12]
    .map((sw) => `<path d="${path}" stroke-width="${r2(sw / s)}" opacity=".13"/>`)
    .join("")}</g>
<g transform="${T(3)}"><path d="${path}" fill="#000" opacity=".35"/></g>
<g transform="${T()}">
  <path d="${path}" fill="url(#paper)"/>
  ${inner}${ghost}
  ${overlay ? overlay(Wd, DEPTH + PAD_Y + body.h / 2, body.h) : ""}
</g>
${text(L.W / 2, tagY, SITE, F.bold, 20, { ls: 4, anchor: "middle", fill: C.fog, opacity: 0.8 })}
</svg>`;
}

// ── Project receipts ──────────────────────────────────────
const verificationOf = (v) => (/on-?chain/i.test(v ?? "") ? "onchain" : /report/i.test(v ?? "") ? "reported" : null);
const fmtOf = (f) => (FORMATS[f] ? f : "square");
const pairs = (list, n) => (Array.isArray(list) ? list : []).slice(0, n).map((it) => (Array.isArray(it) ? it : [it, ""]));

export function receiptSvg(spec = {}) {
  const fmt = fmtOf(spec.format);
  const cols = FORMATS[fmt].cols;
  const tag = String(Math.max(0, Math.trunc(Number(spec.number) || 0))).padStart(4, "0");
  const ver = verificationOf(spec.verification);
  const status = upper(spec.status, 24);
  const title = upper(spec.title, 64) || "RECEIPT";
  // labels print in capitals; values keep their case (hashes, tx ids)
  const items = pairs(spec.lines, 8)
    .map(([l, v]) => [upper(l, 40), clean(v, { max: 48 })])
    .filter(([l, v]) => l || v);
  if (status) items.push(["STATUS", status]);
  const proof = clean(spec.proof, { max: 56 });
  if (proof) items.push(["PROOF", proof]);
  const amount = spec.amount == null ? "" : upper(String(spec.amount), 18);
  const stampText = spec.stamp === undefined ? status : upper(spec.stamp || "", 20);
  // a "VERIFIED" stamp on a receipt that isn't on-chain verified is printed in faded ink, never red
  const unproven = ver !== "onchain" && /(^|[^N])VERIFIED/.test(stampText);
  const stamp = stampText ? { text: stampText, color: unproven ? C.faded : C.stamp } : null;
  const metaEntries = [{ kind: "date", text: receiptDate(spec.date) }, ...(ver ? [{ kind: ver }] : [])];
  const foot = upper(spec.footer ?? FOOTER, 60);
  const titleBlock = big(title, { sizes: cols === 2 ? [50, 44, 38, 32] : [46, 40, 34, 30], maxLines: FORMATS[fmt].titleLines });
  const amountBlocks = amount ? [rule(), total("AMOUNT", amount)] : [];
  const content =
    cols === 2
      ? {
          top: [...header("REGISTER #4", `RECEIPT #${tag}`, true), rule()],
          a: [titleBlock, gap(22), meta(metaEntries, stamp, 6)],
          b: [rows(items), ...amountBlocks, gap(18), barcode(`CHEK-${tag}`)],
          bottom: [rule(), footer(foot)],
        }
      : {
          top: [...header("REGISTER #4", `RECEIPT #${tag}`, false), rule()],
          a: [titleBlock, rule(), rows(items), ...amountBlocks],
          b: [rule(), meta(metaEntries, stamp), gap(16), barcode(`CHEK-${tag}`)],
          bottom: [gap(10), footer(foot)],
        };
  const m = spec.mascot;
  return stage(content, fmt, { character: m ? characterArt("chek", typeof m === "object" ? m : {}) : null });
}

// ── Receipt Generator (public, user text) ─────────────────
const NEGATIVE = /\b(VOID|NOT|NO|NEVER|NONE|NOPE|FAIL|FAILED|UNPAID|DENIED|FAKE|RUGGED|LATE|MISSING|DELETED|LOST|ZERO)\b/;
const CHEK_MOOD = { VERIFIED: ["happy", "point", "stamp"], UNVERIFIED: ["skeptic", "point", "magnifier"], VOID: ["angry", "point", "stamp"] };

export function textReceiptSvg(spec = {}) {
  const fmt = fmtOf(spec.format);
  const tpl = ["classic", "long", "void"].includes(spec.template) ? spec.template : "classic";
  const cols = FORMATS[fmt].cols;
  const given = spec.number != null && spec.number !== "" && Number.isInteger(Number(spec.number));
  const num = given ? Math.abs(Number(spec.number)) % 10000 : randomInt(1000, 10000);
  const tag = String(num).padStart(4, "0");
  const headline = upper(spec.headline, 80) || "RECEIPT";
  const bodyText = clean(spec.body, { max: 320, multiline: true });
  const items = pairs(spec.items, tpl === "long" ? 14 : 8)
    .map(([a, b]) => [upper(a, 48), upper(b, 28)])
    .filter(([a, b]) => a || b)
    .map(([a, b]) => [a, b, tpl === "void" ? "void" : NEGATIVE.test(b) ? "bad" : ""]);
  const totalV = upper(spec.total, 18);
  const user = clean(spec.username, { max: 40 }).replace(/^@+/, "").replace(/\s+/g, "").slice(0, 24);
  const stampText = spec.stamp ? upper(spec.stamp, 16) : tpl === "void" ? "VOID" : "";
  const metaEntries = [{ kind: "date", text: receiptDate(spec.date) }, ...(user ? [{ kind: "note", text: `CUSTOMER @${user}` }] : [])];
  // the void template stamps VOID across the whole receipt instead of the small stamp
  const stamp = stampText && tpl !== "void" ? { text: stampText } : null;
  const head = big(headline, { sizes: cols === 2 ? [46, 40, 34, 30] : [54, 46, 40, 34, 30], maxLines: FORMATS[fmt].titleLines, doto: true });
  const bodyBlock = bodyText ? para(bodyText, { f: F.mono, size: 21, lh: 31, maxLines: tpl === "long" ? 12 : 8 }) : null;
  const totalBlocks = totalV ? [rule(), total("TOTAL", totalV, { strike: tpl === "void" })] : [];
  const sub = "SELF-SERVICE REGISTER";
  const content =
    cols === 2
      ? {
          top: [...header(sub, `RECEIPT #${tag}`, true), rule()],
          a: [head, bodyBlock && gap(14), bodyBlock, gap(22), meta(metaEntries, stamp, 6)],
          b: [rows(items), ...totalBlocks, gap(18), barcode(`CHEK-${tag}`)],
          bottom: [rule(), footer(FOOTER)],
        }
      : {
          top: [...header(sub, `RECEIPT #${tag}`, false), rule()],
          a: [head, bodyBlock && gap(14), bodyBlock, items.length ? rule() : null, rows(items), ...totalBlocks],
          b: [rule(), meta(metaEntries, stamp), gap(16), barcode(`CHEK-${tag}`)],
          bottom: [gap(10), footer(FOOTER)],
        };
  let character = null;
  if (spec.character === "shredder" || spec.character === "coupon") character = characterArt(spec.character);
  else if (spec.character === "chek") {
    const [expr, pose, prop] = CHEK_MOOD[tpl === "void" ? "VOID" : stampText] ?? ["skeptic", "hip", ""];
    character = characterArt("chek", { expr, pose, prop });
  }
  // big stamp across the paper: as large as fits inside it (w = paper width, h = content height)
  const overlay =
    tpl === "void"
      ? (w, cy, h) => {
          let st;
          for (let size = w * 0.19; size >= 24; size -= 4) {
            st = stampShape(stampText || "VOID", { size, rot: -17, maxChars: 12, opacity: 0.85 });
            if (st.bw <= w * 0.86 && st.bh <= h * 0.62) break;
          }
          return st.draw(w / 2, cy);
        }
      : null;
  return stage(content, fmt, { character, long: tpl === "long", rot: tpl === "long" ? -2 : -1, tint: tpl === "void" ? "aged" : "", overlay });
}

// ── PNG ───────────────────────────────────────────────────
export function renderPng(svg, width) {
  const r = new Resvg(svg, {
    fitTo: width ? { mode: "width", value: Math.round(width) } : { mode: "original" },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Martian Mono", monospaceFamily: "Martian Mono", sansSerifFamily: "Martian Mono" },
  });
  return r.render().asPng();
}

export const renderReceipt = (spec = {}) => renderPng(receiptSvg(spec), FORMATS[fmtOf(spec.format)].W);
export const renderTextReceipt = (spec = {}) => renderPng(textReceiptSvg(spec), FORMATS[fmtOf(spec.format)].W);
