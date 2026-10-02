// Watches site and drop activity from the PC (admin API, read-only) and exits when something needs a look,
// so a background run wakes the operator. Every check is appended to private/activity.log.
//   node scripts/watch-activity.mjs [--every 120] [--max 60]
//   exits on: an X drop form error (500) or a new open alert,
//   or after --max minutes with a summary.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const EVERY = arg("every", 120) * 1000;
const MAX = arg("max", 60) * 60e3;
const envFile = join(ROOT, "private", ".env.local");
const env = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {};
const site = JSON.parse(readFileSync(join(ROOT, "config/project.json"), "utf8")).links.website.replace(/\/$/, "");
const LOG = join(ROOT, "private", "activity.log");

async function snapshot() {
  const r = await fetch(`${site}/api/admin`, { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`admin ${r.status}`);
  const j = await r.json();
  const d = await fetch(`${site}/api/public?op=drop&t=${Date.now()}`).then((x) => x.json());
  return {
    at: new Date().toISOString(),
    metrics: j.metrics ?? {},
    x: d.x?.entries ?? 0,
    tg: d.telegram?.entries ?? 0,
    alerts: (j.alerts ?? []).map((a) => `${a.id}:${a.kind}:${a.message.slice(0, 120)}`),
    next: (j.queue ?? []).slice(0, 3).map((q) => `${q.id}@${String(q.publish_after).slice(11, 16)}`),
  };
}

const KEYS = ["visit_x", "visit_tg", "visit_other", "visit_direct", "pv_home", "pv_drop", "pv_print", "rg_gen", "rg_share", "tg_joins", "tg_leaves", "tg_receipts", "tg_scam_deleted"];
const brief = (s) => `X drop ${s.x} · TG drop ${s.tg} · ${KEYS.filter((k) => s.metrics[k]).map((k) => `${k} ${s.metrics[k]}`).join(" · ") || "no visits counted yet"}`;
const xdrop = (m) => Object.entries(m).filter(([k]) => k.startsWith("xdrop_")).map(([k, v]) => `${k.slice(6)} ${v}`).join(", ");

const start = Date.now();
const first = await snapshot();
appendFileSync(LOG, `${first.at} start  ${brief(first)}\n`);
let prev = first;
for (;;) {
  await new Promise((r) => setTimeout(r, EVERY));
  let s;
  try {
    s = await snapshot();
  } catch (e) {
    appendFileSync(LOG, `${new Date().toISOString()} check failed: ${e.message}\n`);
    continue;
  }
  appendFileSync(LOG, `${s.at} ${brief(s)}${xdrop(s.metrics) ? ` · form: ${xdrop(s.metrics)}` : ""}\n`);
  const events = [];
  // entries flow steadily now: they go into the hourly summary, only problems wake the operator
  if ((s.metrics.xdrop_error ?? 0) > (prev.metrics.xdrop_error ?? 0)) events.push(`X drop form errors: ${s.metrics.xdrop_error}`);
  const newAlerts = s.alerts.filter((a) => !prev.alerts.includes(a));
  if (newAlerts.length) events.push(`new alerts: ${newAlerts.join(" | ")}`);
  if (events.length || Date.now() - start >= MAX) {
    console.log(events.length ? `EVENT: ${events.join("; ")}` : `SUMMARY after ${Math.round((Date.now() - start) / 60e3)} min`);
    console.log(`since start: ${brief(first)}`);
    console.log(`now:         ${brief(s)}`);
    if (xdrop(s.metrics)) console.log(`X drop form today: ${xdrop(s.metrics)}`);
    console.log(`next posts: ${s.next.join(", ")}`);
    process.exit(0);
  }
  prev = s;
}
