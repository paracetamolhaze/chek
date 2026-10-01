// Server-side production freshness audit (same rules as `node scripts/prod-audit.mjs`). Stored in settings.prod_audit;
// the live gate refuses autopilot=on unless it passed recently.
import { auditProduction } from "../../shared/prod-audit.mjs";
import { alert, audit, getSetting, setSetting } from "./core.js";
import { history, project, withLiveToken } from "./project.js";

export async function runProdAudit() {
  const p = withLiveToken(project(), await getSetting("token_live"));
  const r = await auditProduction({ site: p.links.website.replace(/\/$/, ""), project: p, history: history() });
  await setSetting("prod_audit", { ok: r.ok, checkedAt: r.checkedAt, site: r.site, problems: r.problems.slice(0, 30) });
  await audit("prodcheck", "prod_audit.run", r.ok ? "ok" : "error", { detail: { problems: r.problems.slice(0, 10) } });
  if (!r.ok) await alert("error", "prod_audit", `Production audit failed (${r.problems.length}): ${r.problems.slice(0, 3).join(" | ")}`);
  return r;
}
