import { readFileSync } from "node:fs";
// Load metrics for the live site on a throttled "mid-range phone on 4G".
//   node scripts/perf.mjs [url]
import { open, close } from "./lib/render.mjs";
const url = process.argv[2] || JSON.parse(readFileSync(new URL("../config/project.json", import.meta.url), "utf8")).links.website + "/";
const b = await open();
for (const [label, throttle] of [["desktop", false], ["mobile 4G + 4x CPU", true]]) {
  const page = await b.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (throttle) {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  } else await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 1500));
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const bytes = res.reduce((s, r) => s + (r.transferSize || 0), nav.transferSize || 0);
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
    return { fcp: Math.round(fcp), lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), requests: res.length + 1, kb: Math.round(bytes / 1024), js: Math.round(res.filter((r) => r.initiatorType === "script").reduce((s, r) => s + r.transferSize, 0) / 1024) };
  });
  console.log(label.padEnd(20), `FCP ${m.fcp} ms · LCP ${m.lcp} ms · CLS ${m.cls} · ${m.requests} requests · ${m.kb} KB transferred (JS ${m.js} KB)`);
  await page.close();
}
await close();
