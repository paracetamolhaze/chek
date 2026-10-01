// Prints the consistency audit with every problem found.   node scripts/consistency-audit.mjs
import { audit } from "./lib/consistency.mjs";

const { results } = audit();
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.title}`);
  for (const p of r.problems) console.log(`    – ${p}`);
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad}/${results.length} consistency rules pass`);
process.exit(bad ? 1 : 0);
