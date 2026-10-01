// Small shared services: settings, audit log, alerts, metrics, costs.
import { db } from "./db.js";

export const DEFAULT_SETTINGS = {
  // off = nothing runs · dry = everything runs but publishing only logs what it would post · on = live
  autopilot: "dry",
  platforms: { x: false, telegram: false }, // flipped on when credentials are connected and checked
  budgets: { dailyUsd: 2, monthlyUsd: 40, aiDailyUsd: 1 },
  limits: { xPerDay: 6, telegramPerDay: 8, minGapMinutes: 45 },
  cadence: { morning: "09:30", day: "14:00", evening: "19:30", tz: "UTC" },
  schedule: { d1: "2026-10-02", launchAt: null },
  owner: { telegramUserId: null },
};

export async function getSetting(key) {
  const sql = await db();
  const [row] = await sql`select value from chek.settings where key = ${key}`;
  return row ? row.value : (DEFAULT_SETTINGS[key] ?? null);
}

export async function setSetting(key, value) {
  const sql = await db();
  await sql`insert into chek.settings (key, value) values (${key}, ${sql.json(value)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

export async function allSettings() {
  const sql = await db();
  const rows = await sql`select key, value from chek.settings`;
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

// AUDIT: timestamp · agent · action · result · source · error
export async function audit(agent, action, result, { ref = null, source = null, detail = null, error = null } = {}) {
  try {
    const sql = await db();
    await sql`insert into chek.audit_log (agent, action, result, ref, source, detail, error)
      values (${agent}, ${action}, ${result}, ${ref}, ${source}, ${detail ? sql.json(detail) : null}, ${error ? String(error).slice(0, 2000) : null})`;
  } catch (e) {
    console.error("audit failed", agent, action, e);
  }
}

export async function alert(level, kind, message, ref = null) {
  const sql = await db();
  // de-duplicate open alerts of the same kind+ref
  const [open] = await sql`select id from chek.alerts where kind = ${kind} and coalesce(ref,'') = ${ref ?? ""} and resolved_at is null limit 1`;
  if (open) return open.id;
  const [row] = await sql`insert into chek.alerts (level, kind, message, ref) values (${level}, ${kind}, ${message}, ${ref}) returning id`;
  return row.id;
}

export async function bump(key, by = 1) {
  const sql = await db();
  await sql`insert into chek.metrics (day, key, value) values (current_date, ${key}, ${by})
    on conflict (day, key) do update set value = chek.metrics.value + excluded.value`;
}

export async function recordCost(provider, units, unit, usd, ref = null) {
  const sql = await db();
  await sql`insert into chek.costs (provider, units, unit, usd, ref) values (${provider}, ${units}, ${unit}, ${usd}, ${ref})`;
}

export async function spend(days, provider = null) {
  const sql = await db();
  const [r] = provider
    ? await sql`select coalesce(sum(usd),0)::float as usd from chek.costs where at > now() - make_interval(days => ${days}) and provider = ${provider}`
    : await sql`select coalesce(sum(usd),0)::float as usd from chek.costs where at > now() - make_interval(days => ${days})`;
  return r.usd;
}

// Budget guard: false → caller must skip the paid action (and an alert is raised once).
export async function withinBudget(provider) {
  const b = await getSetting("budgets");
  const day = await spend(1);
  const month = await spend(30);
  if (day >= b.dailyUsd || month >= b.monthlyUsd) {
    await alert("warn", "budget", `Budget reached: today $${day.toFixed(2)} / $${b.dailyUsd}, 30d $${month.toFixed(2)} / $${b.monthlyUsd}. Paid actions paused.`);
    return false;
  }
  if (provider === "ai_api" && (await spend(1, "ai_api")) >= b.aiDailyUsd) {
    await alert("warn", "budget_ai", `AI budget for today reached ($${b.aiDailyUsd}). AI drafting paused until tomorrow.`);
    return false;
  }
  return true;
}

// Point-in-time value (e.g. channel size) — overwritten for the day, not summed.
export async function gauge(key, value) {
  const sql = await db();
  await sql`insert into chek.metrics (day, key, value) values (current_date, ${key}, ${value})
    on conflict (day, key) do update set value = excluded.value`;
}
