// Shared helpers for post queues: schedule slots → times, placeholder filling, X length.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const paths = {
  project: join(ROOT, "config/project.json"),
  schedule: join(ROOT, "content/schedule.json"),
  history: join(ROOT, "content/history.json"),
  x: join(ROOT, "content/x/queue.json"),
  tg: join(ROOT, "content/telegram/queue.json"),
};

export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const writeJson = (p, data) => writeFileSync(p, JSON.stringify(data, null, 2) + "\n");

export { slotTime, fmtUtc, placeholders, fill, SAMPLE, xLength } from "../../shared/content-core.mjs";
