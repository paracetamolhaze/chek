// Fresh production fetch of the public site → stale or superseded claims fail.
//   node scripts/prod-audit.mjs                 → checks config.links.website
//   node scripts/prod-audit.mjs https://…       → checks another origin (e.g. the new domain before switching)
import { auditProduction } from "../shared/prod-audit.mjs";
import { paths, readJson } from "./lib/content.mjs";

const project = readJson(paths.project);
const history = readJson(paths.history ?? new URL("../content/history.json", import.meta.url));
const site = (process.argv[2] || project.links.website).replace(/\/$/, "");
const r = await auditProduction({ site, project, history });
for (const [p, s] of Object.entries(r.pages)) console.log(`  ${s === 200 ? "✓" : "✗"} ${p} ${s}`);
for (const p of r.problems) console.log(`  ✗ ${p}`);
console.log(r.ok ? `PRODUCTION CLEAN — ${site} at ${r.checkedAt}` : `PRODUCTION HAS ${r.problems.length} PROBLEM(S) — ${site}`);
process.exit(r.ok ? 0 : 1);
