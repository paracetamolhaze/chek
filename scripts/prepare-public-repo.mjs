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

// --utc: store every commit's time with a +0000 offset (same instant; hides the local time zone)
const UTC = process.argv.includes("--utc");
const FMT = "--format=%H%x09%at%x09%ct%x09%s";
const oldLog = git(["log", "--reverse", FMT], ROOT).trim().split("\n").map((l) => l.split("\t"));
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
git(
  [
    "filter-branch",
    "-f",
    ...(UTC ? ["--env-filter", 'export GIT_AUTHOR_DATE="${GIT_AUTHOR_DATE% *} +0000"; export GIT_COMMITTER_DATE="${GIT_COMMITTER_DATE% *} +0000"'] : []),
    "--tree-filter",
    `node "${filter.replace(/\\/g, "/")}"`,
    "--",
    "--all",
  ],
  target,
  { FILTER_BRANCH_SQUELCH_WARNING: "1" },
);
git(["for-each-ref", "--format=%(refname)", "refs/original/"]).split("\n").filter(Boolean).forEach((r) => git(["update-ref", "-d", r]));
git(["reflog", "expire", "--expire=now", "--all"]);
git(["gc", "--quiet", "--prune=now"]);

// old → new mapping (messages and dates are unchanged, order is the same)
const newLog = git(["log", "--reverse", FMT]).trim().split("\n").map((l) => l.split("\t"));
if (newLog.length !== oldLog.length) throw new Error("commit count changed");
// same instants (epoch seconds) and same messages, commit by commit
const map = oldLog.map(([h, at, ct, s], i) => {
  if (newLog[i][1] !== at || newLog[i][2] !== ct || newLog[i][3] !== s) throw new Error(`commit ${h} time/message changed`);
  return { old: h.slice(0, 7), new: newLog[i][0].slice(0, 7), date: new Date(Number(at) * 1000).toISOString().replace(".000", ""), subject: s };
});

const hist = join(target, "content/history.json");
let h = readFileSync(hist, "utf8");
for (const m of map) h = h.split(`commit ${m.old}`).join(`commit ${m.new}`);
writeFileSync(hist, h);
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(target, "docs/repository-sanitization.md"),
  `# This repository was sanitized before publication

On ${today} (UTC), before the repository went public, its history was rewritten once for privacy.

**Removed from every commit:**
- local file paths that contained the owner's operating-system username;
- hosting/deployment identifiers (team and project ids);
- mentions of the owner's location and local network;
- private owner notes (kept outside the repository);
${UTC ? "- local time-zone offsets: every commit time is stored in UTC (+0000) — the same instant, only the offset changed;\n" : ""}
**Kept exactly:** every commit message, every commit moment (author and committer time) and the order of commits. File contents changed only where the items above were removed.

**What this means for you:** because file contents changed, every commit hash changed. Git history documents how CHEK was built, but commit times can technically be rewritten — so don't treat a git hash or a git date as independent proof. Cross-check with the other receipts: X and Telegram post timestamps, the deployed website, and after launch the blockchain itself.

The table in [history-rewrite.md](history-rewrite.md) maps the hashes that appeared before publication (for example on the website's build log) to the published ones. It is a lookup, not evidence.
`,
);
writeFileSync(
  join(target, "docs/history-rewrite.md"),
  `# Hash lookup (before → after the one-time sanitization)

See [repository-sanitization.md](repository-sanitization.md) for what was removed and why. Messages and moments are unchanged; this is a lookup, not evidence.

| Author time (UTC) | Before | Published | Commit |
|---|---|---|---|
${map.map((m) => `| ${m.date} | \`${m.old}\` | \`${m.new}\` | ${m.subject.replace(/\|/g, "\\|")} |`).join("\n")}
`,
);
git(["add", "content/history.json", "docs/history-rewrite.md", "docs/repository-sanitization.md"]);
const nowUtc = `${Math.floor(Date.now() / 1000)} +0000`;
git(
  ["commit", "--quiet", "-m", "publish: repository sanitized for privacy before publication\n\nCommit messages and moments unchanged; hashes changed. See docs/repository-sanitization.md."],
  target,
  UTC ? { GIT_AUTHOR_DATE: nowUtc, GIT_COMMITTER_DATE: nowUtc } : {},
);

const findings = scanRepo(target).filter((f) => f.file !== "docs/history-rewrite.md" || !/hash/.test(f.why));
const uniq = [...new Set(findings.map((f) => `${f.where} ${f.commit} ${f.file} — ${f.why}${f.text ? ` [${f.text.slice(0, 40)}]` : ""}`))];
console.log(`public copy: ${target}`);
console.log(`commits: ${map.length} rewritten (+1 mapping commit), times/messages preserved${UTC ? ", offsets normalized to UTC" : ""}`);
console.log(uniq.length ? `NOT CLEAN:\n${uniq.join("\n")}` : "scan: clean (files + full history)");
process.exit(uniq.length ? 1 : 0);
