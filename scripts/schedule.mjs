// Recomputes publishAfter for every queued post from content/schedule.json and checks X post lengths.
//   node scripts/schedule.mjs
//   node scripts/schedule.mjs --d1 2026-10-03 --launch 2026-10-08T15:00:00Z
import { fill, paths, placeholders, readJson, SAMPLE, slotTime, writeJson, xLength } from "./lib/content.mjs";

const args = process.argv.slice(2);
const schedule = readJson(paths.schedule);
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
if (arg("--d1")) schedule.d1 = arg("--d1");
if (arg("--launch")) schedule.launchAt = new Date(arg("--launch")).toISOString();
writeJson(paths.schedule, schedule);

const project = readJson(paths.project);
const values = placeholders(project, schedule);
let warn = 0;
for (const file of [paths.x, paths.tg]) {
  const q = readJson(file);
  for (const p of q.posts) {
    p.publishAfter = slotTime(p.slot, schedule);
    if (file === paths.x) {
      for (const [i, part] of [p.text, ...(p.thread || [])].entries()) {
        // measure with realistic stand-ins for values that don't exist yet
        const sample = fill(part, Object.fromEntries(Object.entries({ ...SAMPLE, ...values }).map(([k, v]) => [k, v ?? SAMPLE[k]]))).text;
        const n = xLength(sample);
        if (n > 280) {
          warn++;
          console.log(`⚠ ${p.id}${i ? ` part ${i + 1}` : ""}: ${n} chars (> 280)`);
        }
      }
    }
  }
  writeJson(file, q);
}
console.log(`d1=${schedule.d1} launchAt=${schedule.launchAt ?? "not set (proposed " + schedule.proposedLaunchAt + ")"}${warn ? ` · ${warn} too long` : " · all X posts ≤ 280"}`);
