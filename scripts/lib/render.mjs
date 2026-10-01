// Renders HTML/SVG to PNG with the locally installed Chrome (puppeteer-core, no download).
import { existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && existsSync(p));

const font = (name) => pathToFileURL(`${ROOT}brand/fonts/${name}`).href;

export const FONT_CSS = `
@font-face { font-family: "Doto"; src: url("${font("Doto-Variable.woff2")}") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Martian Mono"; src: url("${font("MartianMono-Variable.woff2")}") format("woff2"); font-weight: 100 800; font-stretch: 75% 112.5%; }
`;

let browser;
export async function open() {
  if (!CHROME) throw new Error("Chrome not found: set CHROME_PATH");
  browser ??= await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
  return browser;
}

export async function close() {
  await browser?.close();
  browser = undefined;
}

// html: body markup; css: extra CSS; size: [w, h]; out: png path; transparent: omit background
export async function shoot({ html, css = "", size: [w, h], out, transparent = false, scale = 1 }) {
  const b = await open();
  const page = await b.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${w}px;height:${h}px;overflow:hidden;${transparent ? "background:transparent" : ""}}
    ${css}</style></head><body>${html}</body></html>`,
    { waitUntil: "load" },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: transparent, type: "png" });
  await page.close();
  return out;
}
