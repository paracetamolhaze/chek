// Screenshots of the site for design review.
//   node scripts/shot.mjs                      → serves website/out locally
//   node scripts/shot.mjs https://site.app     → shoots the live site
// Output: test-artifacts/<page>-<device>.png
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { open, close } from "./lib/render.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "test-artifacts");
mkdirSync(OUT, { recursive: true });

const PAGES = (process.env.PAGES || "/,/history,/transparency,/kit").split(",");
const DEVICES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ...(process.env.TABLET ? { tablet: { width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true } } : {}),
};
const FULL = process.env.FULL !== "0";

let base = process.argv[2];
let server;
if (!base) {
  const dir = join(ROOT, "website", "out");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon", ".json": "application/json", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };
  server = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    let f = join(dir, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f) && existsSync(f + ".html")) f += ".html";
    if (!existsSync(f)) {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end(existsSync(join(dir, "404.html")) ? readFileSync(join(dir, "404.html")) : "404");
    }
    res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" });
    res.end(readFileSync(f));
  }).listen(4317);
  base = "http://127.0.0.1:4317";
}

const b = await open();
const errors = [];
for (const [name, vp] of Object.entries(DEVICES)) {
  for (const path of PAGES) {
    const page = await b.newPage();
    page.on("pageerror", (e) => errors.push(`${path} ${name}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${path} ${name} console: ${m.text()}`));
    await page.setViewport(vp);
    await page.goto(base + path, { waitUntil: "networkidle0" });
    // reveal everything for full-page shots
    await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-in")));
    await new Promise((r) => setTimeout(r, 400));
    const slug = path === "/" ? "home" : path.replace(/\W+/g, "");
    const file = join(OUT, `${slug}-${name}.png`);
    await page.screenshot({ path: file, fullPage: FULL });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${file}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ""}`);
    await page.close();
  }
}
await close();
server?.close();
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
