// Integration test of the production backend against a throwaway local Postgres (never the real database).
//   docker run -d --name chek-test-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55462:5432 postgres:16-alpine
//   node scripts/test-backend.mjs
// Runs with autopilot "dry": nothing is ever sent to X or Telegram.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://postgres:test@127.0.0.1:55462/postgres?sslmode=disable";
process.env.APP_SECRET = "test-app-secret";
process.env.CRON_SECRET = "test-cron";
process.env.ADMIN_TOKEN = "test-admin";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.X_CLIENT_ID;

const { db } = await import("../server/lib/db.js");
const core = await import("../server/lib/core.js");
const { syncSeed, conditionsMet, context, render } = await import("../server/lib/queue.js");
const { syncBuildLog, createReceipt, listReceipts, publicReceipt } = await import("../server/lib/receipts.js");
const { runPublisher } = await import("../server/lib/publisher.js");
const { vaultSet, vaultGet } = await import("../server/lib/vault.js");
const { tick } = await import("../server/lib/jobs.js");
const admin = await import("../api/admin.js");
const cron = await import("../api/cron.js");
const pub = await import("../api/public.js");

let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failed++;
};

const sql = await db();
await sql`truncate chek.queue, chek.receipts, chek.audit_log, chek.alerts, chek.news_items, chek.costs, chek.metrics, chek.settings, chek.vault restart identity cascade`;
ok(true, "migrations applied, tables truncated");

// receipts
const n = await syncBuildLog();
const rs = await listReceipts();
ok(n === rs.length && n > 5, `build log → ${n} reported receipts`);
ok(rs.every((r) => r.verification === "reported"), "build-log receipts are PROJECT REPORTED (never on-chain)");
ok((await syncBuildLog()) === 0, "re-sync is idempotent");
let threw = false;
try {
  await createReceipt({ kind: "fees", title: "X", status: "CLAIMED", verification: "onchain" });
} catch {
  threw = true;
}
ok(threw, "on-chain receipt without a transaction is refused");
ok(publicReceipt(rs[0]).label.startsWith("#"), `public receipt label ${publicReceipt(rs[0]).label}`);

// queue
const seeded = await syncSeed();
ok(seeded >= 35, `seed queue synced (${seeded} items)`);
const [x9] = await sql`select * from chek.queue where id = 'x-009'`;
const ctx = await context();
const missing = await conditionsMet(x9, ctx);
ok(missing.includes("links.telegram") && missing.includes("posted:tg-001"), `x-009 waits for: ${missing.join(", ")}`);
const [x18] = await sql`select * from chek.queue where id = 'x-018'`;
ok((await conditionsMet(x18, ctx)).includes("live"), "x-018 (launch post) waits for the live CA");
const [x1] = await sql`select * from chek.queue where id = 'x-001'`;
ok(render(x1, ctx, new Date("2026-10-02T15:00:00Z")).parts[0].startsWith("day 2."), "x-001 renders DAY_N from the real public date (day 2 on Oct 2)");

// publisher in dry mode, at a time when D1–D3 posts are due
await core.setSetting("autopilot", "dry");
const r1 = await runPublisher(new Date("2026-10-02T15:01:00Z"));
const dry = await sql`select ref, detail from chek.audit_log where result = 'dry'`;
ok(dry.length >= 1 && dry.some((d) => d.ref === "x-001"), `dry run logged would-publish: ${dry.map((d) => d.ref).join(", ")}`);
const [{ pubd }] = await sql`select count(*)::int as pubd from chek.queue where status = 'published'`;
ok(pubd === 0, "dry mode published nothing");
ok(r1.x.live === false && r1.telegram.live === false, "platforms not live without credentials");

// guard: inject a bad post
await sql`insert into chek.queue (id, platform, category, level, status, publish_after, payload, origin)
  values ('test-bad', 'x', 'meme', 'auto', 'ready', '2026-10-02T15:00:00Z', ${sql.json({ parts: ["$CHEK will moon, guaranteed 100x returns"] })}, 'engine')`;
await runPublisher(new Date("2026-10-02T15:02:00Z"));
const [bad] = await sql`select status, last_error from chek.queue where id = 'test-bad'`;
ok(bad.status === "failed" && /promises a return|predicts price/.test(bad.last_error), "guard blocked a price-promise post");
const [al] = await sql`select count(*)::int as c from chek.alerts where kind = 'guard_block'`;
ok(al.c === 1, "alert raised for the blocked post");

// review escalation
await sql`insert into chek.queue (id, platform, category, level, status, publish_after, payload, origin)
  values ('test-review', 'telegram', 'meme', 'auto', 'ready', '2026-10-02T15:00:00Z', ${sql.json({ parts: ["the $CHEK chart today is a receipt of pure vibes"] })}, 'engine')`;
await runPublisher(new Date("2026-10-02T15:03:00Z"));
const [rv] = await sql`select status from chek.queue where id = 'test-review'`;
ok(rv.status === "review", "price-talk post escalated to owner review");

// expiry of a missed launch-relative post
await core.setSetting("schedule", { d1: "2026-10-02", launchAt: "2026-10-02T10:00:00Z" });
await sql`update chek.queue set publish_after = '2026-10-02T10:05:00Z' where id = 'x-017'`;
await runPublisher(new Date("2026-10-02T15:04:00Z"));
const [ex] = await sql`select status from chek.queue where id = 'x-017'`;
ok(ex.status === "expired", "launch-relative post expires instead of firing hours late");

// vault
await vaultSet("t", { a: 1 });
ok((await vaultGet("t")).a === 1, "vault round-trip (AES-GCM)");
const [raw] = await sql`select value_enc from chek.vault where key = 't'`;
ok(!raw.value_enc.includes('"a"'), "vault stores ciphertext only");

// API auth + handlers
const req = (url, init = {}) => new Request(`http://localhost${url}`, init);
ok((await admin.GET(req("/api/admin"))).status === 401, "admin API refuses without token");
const st = await admin.GET(req("/api/admin", { headers: { authorization: "Bearer test-admin" } }));
const sj = await st.json();
ok(st.status === 200 && sj.queue.length > 0 && sj.integrations.database, "admin status works with token");
ok((await cron.GET(req("/api/cron"))).status === 401, "cron refuses without secret");
await core.setSetting("schedule", { d1: "2026-10-02", launchAt: null });
const c = await cron.GET(req("/api/cron", { headers: { "x-cron-secret": "test-cron" } }));
const cj = await c.json();
ok(c.status === 200 && cj.result.publisher && cj.result.onchain, `cron tick ran jobs: ${Object.keys(cj.result).join(", ")}`);
const pr = await pub.GET(req("/api/public?op=receipts"));
ok(pr.status === 200 && (await pr.json()).receipts.length === n, "public receipts endpoint");
const cr = await (await pub.GET(req("/api/public?op=creator"))).json();
ok(cr.live === false, "creator position: not live before launch");

const [{ c: audits }] = await sql`select count(*)::int as c from chek.audit_log`;
ok(audits > 10, `audit log has ${audits} entries`);

console.log(failed ? `\n${failed} FAILED` : "\nall backend checks passed");
await sql.end({ timeout: 2 });
process.exit(failed ? 1 : 0);
