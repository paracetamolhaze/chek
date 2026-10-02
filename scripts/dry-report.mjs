// Dry-run report: every post the system would have published, every rejected post, every review request,
// AI jobs, news decisions and alerts — plus the upcoming calendar pre-checked with sample values.
//   node scripts/dry-report.mjs            → private/dry-run-report.md (git-ignored)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const raw = execFileSync(process.execPath, ["scripts/admin.mjs", "dry_report"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
const r = JSON.parse(raw.slice(raw.indexOf("{")));
const t = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "—");
const quote = (parts) => (parts || []).map((p) => p.split("\n").map((l) => `> ${l}`).join("\n")).join("\n>\n> — — —\n>\n");
const by = (v) => r.log.filter((l) => l.verdict === v);

const md = [];
md.push(`# Dry run ${r.run}`, "", `${t(r.startedAt)} → ${t(r.endsAt)} UTC · autopilot: ${r.autopilot} · nothing was published.`, "");
md.push(`Live gate: ${r.gate.ok ? "OPEN" : `CLOSED — ${r.gate.missing.join("; ")}`}`, "");
md.push(`| would publish | rejected | review | approved | expired | waiting |`, `|---|---|---|---|---|---|`, `| ${by("would_publish").length} | ${by("rejected").length} | ${by("review").length} | ${by("approved").length} | ${by("expired").length} | ${new Set(by("waiting").map((l) => l.queue_id)).size} |`, "");

md.push("## Would have published", "");
for (const l of by("would_publish")) {
  md.push(`### ${t(l.at)} UTC · ${l.platform.toUpperCase()} · ${l.queue_id} (${l.origin}, ${l.category}, ${l.level})`, "", quote(l.parts), "");
  if (l.media) md.push(`Image: ${l.media}`, "");
  if (l.source) md.push(`Source: ${l.source.source} · ${l.source.url} · published ${t(l.source.publishedAt)} · checked ${t(l.source.checkedAt)}`, "");
  if (l.reasons?.length) md.push(`Why: ${l.reasons.join(" · ")}`, "");
}
md.push("## Rejected by the guards", "");
for (const l of by("rejected")) md.push(`- ${t(l.at)} · ${l.platform} · ${l.queue_id}: ${l.reasons.join("; ")}`, "", quote(l.parts), "");
if (!by("rejected").length) md.push("(none)", "");
md.push("## Sent to the owner for review", "");
for (const l of by("review")) md.push(`- ${t(l.at)} · ${l.platform} · ${l.queue_id}: ${l.reasons.join("; ")}`, "", quote(l.parts), "");
if (!by("review").length) md.push("(none)", "");
md.push("## Expired / waiting", "");
for (const l of [...by("expired"), ...by("waiting")]) md.push(`- ${l.verdict} · ${l.queue_id}: ${l.reasons.join("; ")}`);
md.push("", "## AI jobs (PC agent, Claude subscription)", "");
for (const j of r.jobs) md.push(`- #${j.id} ${j.kind} · ${j.status} · created ${t(j.created_at)}${j.finished_at ? ` · done ${t(j.finished_at)}` : ""}${j.error ? ` · ${j.error}` : ""}`);
if (!r.jobs.length) md.push("(none)");
md.push("", "## News desk decisions", "");
for (const n of r.news) md.push(`- ${n.status.toUpperCase()} · ${n.source}: ${n.title} — ${n.reason ?? ""} (${n.url})`);
if (!r.news.length) md.push("(none)");
md.push("", "## Alerts", "");
for (const a of r.alerts) md.push(`- ${t(a.at)} · ${a.level} · ${a.kind}: ${a.message}`);
if (!r.alerts.length) md.push("(none)");
md.push("", "## Upcoming calendar, pre-checked now (sample values where the real ones don't exist yet)", "");
for (const p of r.preview) {
  md.push(`### ${p.id} · ${p.platform} · ${p.slot ?? "—"} · due ${t(p.dueAt)} · ${p.guard}${p.sampleValues.length ? ` · sample: ${p.sampleValues.join(", ")}` : ""}`, "", quote(p.parts), "");
  if (p.media) md.push(`Image: ${p.media}`, "");
  if (p.problems.length) md.push(`Guard notes: ${p.problems.join("; ")}`, "");
}
mkdirSync(join(ROOT, "private"), { recursive: true });
writeFileSync(join(ROOT, "private", "dry-run-report.md"), md.join("\n"));
console.log(`private/dry-run-report.md · would publish ${by("would_publish").length} · rejected ${by("rejected").length} · review ${by("review").length} · upcoming ${r.preview.length}`);
