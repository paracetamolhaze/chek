// Builds a publishable copy of the repository with personal data removed from EVERY commit.
//   node scripts/prepare-public-repo.mjs <target-dir>
// - clones this repo into <target-dir> (the original is not touched)
// - applies private/scrub.json (git-ignored) to every commit; author/committer dates and messages are kept
// - writes docs/history-rewrite.md (old → new hash for every commit) and fixes build-log labels
// - scans the result (current files + full history); exits 1 if anything personal or secret remains
// It never pushes. Publishing is a separate, owner-approved step.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepo } from "./lib/public-scan.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const target = resolve(process.argv[2] || join(ROOT, "..", "chek-public"));
if (existsSync(target)) throw new Error(`${target} exists — remove it first`);
const rules = join(ROOT, "private/scrub.json");
if (!existsSync(rules)) throw new Error("private/scrub.json missing");
const git = (args, cwd = target, env = {}) => execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 1 << 28 });

const oldLog = git(["log", "--reverse", "--format=%H%x09%aI%x09%s"], ROOT).trim().split("\n").map((l) => l.split("\t"));
git(["clone", "--quiet", "--no-local", ROOT, target], ROOT);

// tree filter: plain node script outside the clone
const tmp = mkdtempSync(join(tmpdir(), "chek-scrub-"));
const filter = join(tmp, "scrub.mjs");
writeFileSync(
  filter,
  `import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const R = JSON.parse(readFileSync(${JSON.stringify(rules)}, "utf8"));
for (const f of R.deleteFiles) if (existsSync(f)) rmSync(f);
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\\0").filter(Boolean);
for (const f of files) {
  if (!existsSync(f) || /\\.(png|ico|gif|mp4|woff2)$/i.test(f)) continue;
  let s = readFileSync(f, "utf8");
  const before = s;
  for (const [a, b] of R.replace) s = s.split(a).join(b);
  if (s !== before) writeFileSync(f, s);
}
`,
);
git(["filter-branch", "-f", "--tree-filter", `node "${filter.replace(/\\/g, "/")}"`, "--", "--all"], target, { FILTER_BRANCH_SQUELCH_WARNING: "1" });
git(["for-each-ref", "--format=%(refname)", "refs/original/"]).split("\n").filter(Boolean).forEach((r) => git(["update-ref", "-d", r]));
git(["reflog", "expire", "--expire=now", "--all"]);
git(["gc", "--quiet", "--prune=now"]);

// old → new mapping (messages and dates are unchanged, order is the same)
const newLog = git(["log", "--reverse", "--format=%H%x09%aI%x09%s"]).trim().split("\n").map((l) => l.split("\t"));
if (newLog.length !== oldLog.length) throw new Error("commit count changed");
const map = oldLog.map(([h, d, s], i) => {
  if (newLog[i][1] !== d || newLog[i][2] !== s) throw new Error(`commit ${h} date/message changed`);
  return { old: h.slice(0, 7), new: newLog[i][0].slice(0, 7), date: d, subject: s };
});

const hist = join(target, "content/history.json");
let h = readFileSync(hist, "utf8");
for (const m of map) h = h.split(`commit ${m.old}`).join(`commit ${m.new}`);
writeFileSync(hist, h);
writeFileSync(
  join(target, "docs/history-rewrite.md"),
  `# History rewrite before publication

Before this repository went public, personal data (a local file path with the owner's username, a hosting team id, the owner's location) was removed from every commit.
Commit **dates and messages were kept exactly**; only file contents changed, so every commit hash changed.
Old hashes appear in early build-log entries and posts; this table maps them.

| Date (author) | Old | New | Commit |
|---|---|---|---|
${map.map((m) => `| ${m.date} | \`${m.old}\` | \`${m.new}\` | ${m.subject.replace(/\|/g, "\\|")} |`).join("\n")}
`,
);
git(["add", "content/history.json", "docs/history-rewrite.md"]);
git(["commit", "--quiet", "-m", "publish: personal data removed from history; old → new hash map\n\nCommit dates and messages unchanged. See docs/history-rewrite.md."]);

const findings = scanRepo(target).filter((f) => f.file !== "docs/history-rewrite.md" || !/hash/.test(f.why));
const uniq = [...new Set(findings.map((f) => `${f.where} ${f.commit} ${f.file} — ${f.why}${f.text ? ` [${f.text.slice(0, 40)}]` : ""}`))];
console.log(`public copy: ${target}`);
console.log(`commits: ${map.length} rewritten (+1 mapping commit), dates/messages preserved`);
console.log(uniq.length ? `NOT CLEAN:\n${uniq.join("\n")}` : "scan: clean (files + full history)");
process.exit(uniq.length ? 1 : 0);
