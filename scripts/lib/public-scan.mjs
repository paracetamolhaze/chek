// What must never be in a public repository — in the current files OR anywhere in git history.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PATTERNS = [
  [/\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`]+/i, "personal Windows home path (drive + Users + name)"],
  [/\/(?:home|Users)\/[a-z][\w.-]+\//, "personal Unix/macOS home path"],
  [/\b(?:[A-Za-z]:[\\/]|\/)[\w .+-]*kick\+twitch/i, "path to a local secrets folder"],
  [/\bteam_[A-Za-z0-9]{20,}\b/, "Vercel team id"],
  [/\bprj_[A-Za-z0-9]{20,}\b/, "Vercel project id"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "PEM private key"],
  [/\b(?:VERCEL_TOKEN|BOT_TOKEN|API_KEY|SECRET|PASSWORD)\s*=\s*['"]?[A-Za-z0-9_\-]{16,}/, "env-style secret value"],
  [/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, "Telegram bot token"],
  [/\[(\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\]/, "Solana keypair array"],
  [/\b(?:sessionid|auth_token|ct0)=[A-Za-z0-9%]{16,}/i, "auth cookie"],
  [/[\w.+-]+@(?:gmail|yahoo|outlook|mail|yandex)\.\w+/i, "personal e-mail"],
];

const FORBIDDEN_FILES = [/(^|\/)\.env/, /\.pem$/, /\.key$/, /keypair.*\.json$/i, /wallet.*\.json$/i, /(^|\/)private\//, /(^|\/)\.vercel\//, /\.bundle$/, /(^|\/)backup/i, /cookies?\.(txt|json)$/i];

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });

// Owner-specific words (username, city, …) live in the git-ignored private/scan-patterns.json,
// so this public file never contains them: { "patterns": [["regex", "why"], …] }
function privatePatterns(cwd) {
  for (const dir of [cwd, process.env.SCAN_PRIVATE_DIR].filter(Boolean)) {
    const f = join(dir, "private/scan-patterns.json");
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")).patterns.map(([re, why]) => [new RegExp(re, "i"), why]);
  }
  return [];
}

export function scanRepo(cwd) {
  const PATTERNS_ALL = [...PATTERNS, ...privatePatterns(cwd)];
  const findings = [];
  for (const f of git(["ls-files"], cwd).split("\n").filter(Boolean))
    for (const re of FORBIDDEN_FILES) if (re.test(f)) findings.push({ where: "tracked", commit: "HEAD", file: f, why: "forbidden file type/location" });
  for (const f of git(["log", "--all", "--name-only", "--format="], cwd).split("\n").filter(Boolean))
    for (const re of FORBIDDEN_FILES) if (re.test(f) && !findings.some((x) => x.file === f)) findings.push({ where: "history", commit: "?", file: f, why: "forbidden file existed in history" });
  // every added line in every commit, plus every commit message and author
  const log = git(["log", "--all", "-p", "--format=@@COMMIT %h %an <%ae>%n%B", "--no-color"], cwd);
  let commit = "?";
  let file = "?";
  for (const line of log.split("\n")) {
    if (line.startsWith("@@COMMIT ")) {
      commit = line.split(" ")[1];
      file = "?";
      const author = line.slice(9 + commit.length);
      for (const [re, why] of PATTERNS_ALL) if (re.test(author)) findings.push({ where: "author", commit, file: "-", why, text: author });
      continue;
    }
    if (line.startsWith("+++ b/")) {
      file = line.slice(6);
      continue;
    }
    if (!line.startsWith("+") && !(commit !== "?" && file === "?")) continue;
    for (const [re, why] of PATTERNS_ALL) {
      const m = line.match(re);
      if (m) findings.push({ where: line.startsWith("+") ? "history" : "message", commit, file, why, text: m[0] });
    }
  }
  // working tree (tracked) — what the site/repo shows right now
  const tree = git(["grep", "-n", "-I", "-E", "."], cwd).split("\n");
  for (const l of tree) for (const [re, why] of PATTERNS_ALL) {
    const m = l.match(re);
    if (m) findings.push({ where: "tracked", commit: "HEAD", file: l.split(":")[0], why, text: m[0] });
  }
  return findings;
}
