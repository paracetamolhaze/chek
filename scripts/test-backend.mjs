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
await sql`truncate chek.queue, chek.receipts, chek.audit_log, chek.alerts, chek.news_items, chek.costs, chek.metrics, chek.settings, chek.vault, chek.dry_log, chek.ai_jobs, chek.interactions restart identity cascade`;
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
ok(seeded >= 30, `seed queue synced (${seeded} items)`);
const ctx = await context();
const [x310] = await sql`select * from chek.queue where id = 'x-310'`;
ok((await conditionsMet(x310, ctx)).includes("live"), "x-310 (launch post) waits for the verified mint");
const [x205] = await sql`select * from chek.queue where id = 'x-205'`;
ok((await conditionsMet(x205, ctx)).includes("launchAt"), "x-205 (launch-time announcement) waits for the owner-confirmed launch time");
const [x101] = await sql`select * from chek.queue where id = 'x-101'`;
ok(render(x101, ctx, new Date("2026-10-02T15:00:00Z")).parts[0].startsWith("day 2."), "x-101 renders DAY_N from the real public date (day 2 on Oct 2)");

// publisher in dry mode: D1 posts due at 15:01
await core.setSetting("autopilot", "dry");
await core.setSetting("dry_run", { id: "test-run", startedAt: "2026-10-02T00:00:00Z", endsAt: "2026-10-03T00:00:00Z" });
await core.setSetting("schedule", { d1: "2026-10-02", launchAt: null });
await sql`update chek.queue set publish_after = case id when 'tg-101' then '2026-10-02T12:30:00Z'::timestamptz when 'x-101' then '2026-10-02T13:00:00Z'::timestamptz else publish_after end`;
await runPublisher(new Date("2026-10-02T15:01:00Z"));
await runPublisher(new Date("2026-10-02T15:02:00Z"));
const would = await sql`select queue_id, parts, media from chek.dry_log where run = 'test-run' and verdict = 'would_publish'`;
ok(would.some((d) => d.queue_id === "x-101") && would.some((d) => d.queue_id === "tg-101"), `dry run logged would-publish with full text: ${would.map((d) => d.queue_id).join(", ")}`);
ok(would.find((d) => d.queue_id === "x-101")?.media?.endsWith("/media/mascot/01-printing.png"), "dry log keeps the media URL");
const [{ pubd }] = await sql`select count(*)::int as pubd from chek.queue where status = 'published'`;
ok(pubd === 0, "dry mode published nothing");
const [{ dp }] = await sql`select count(*)::int as dp from chek.queue where status = 'dry_published'`;
ok(dp === 2, `dry-published items are consumed once (${dp})`);

// guards: old ticker + price promise are blocked, price talk goes to review
await sql`insert into chek.queue (id, platform, category, level, status, publish_after, payload, origin)
  values ('test-bad', 'x', 'meme', 'auto', 'ready', '2026-10-02T15:00:00Z', ${sql.json({ parts: ["$CHEKD will moon, guaranteed 100x returns"] })}, 'engine'),
         ('test-old', 'telegram', 'meme', 'auto', 'ready', '2026-10-02T15:00:00Z', ${sql.json({ parts: ["gm from $CHEK"] })}, 'engine')`;
await runPublisher(new Date("2026-10-02T16:00:00Z"));
const [bad] = await sql`select status, last_error from chek.queue where id = 'test-bad'`;
ok(bad.status === "failed" && /promises a return|predicts price/.test(bad.last_error), "guard blocked a price-promise post");
const [old] = await sql`select status, last_error from chek.queue where id = 'test-old'`;
ok(old.status === "failed" && /old ticker/.test(old.last_error), "guard blocked the old ticker $CHEK");
const rej = await sql`select queue_id, reasons from chek.dry_log where verdict = 'rejected'`;
ok(rej.length === 2, "rejected posts are in the dry-run log with reasons");
await sql`insert into chek.queue (id, platform, category, level, status, publish_after, payload, origin)
  values ('test-review', 'telegram', 'meme', 'auto', 'ready', '2026-10-02T15:00:00Z', ${sql.json({ parts: ["the $CHEKD chart today is a receipt of pure vibes"] })}, 'engine')`;
await runPublisher(new Date("2026-10-02T17:00:00Z"));
const [rv] = await sql`select status from chek.queue where id = 'test-review'`;
ok(rv.status === "review", "price-talk post escalated to owner review");

// expiry of a missed launch-relative post
await core.setSetting("schedule", { d1: "2026-10-02", launchAt: "2026-10-02T10:30:00Z" });
await sql`update chek.queue set publish_after = '2026-10-02T10:00:00Z' where id = 'x-302'`;
await runPublisher(new Date("2026-10-02T15:04:00Z"));
const [ex] = await sql`select status from chek.queue where id = 'x-302'`;
ok(ex.status === "expired", "launch-relative post expires instead of firing hours late");

// AI jobs for the PC agent (no API key → agent transport)
const { runEngine } = await import("../server/lib/engine.js");
const { claimJob, completeJob } = await import("../server/lib/ai-jobs.js");
const eng = await runEngine();
ok(eng.ai?.mode === "agent" && eng.ai.jobId, "engine queued an AI job for the PC agent");
const job = await claimJob("test-pc");
ok(job?.kind === "engine_plan" && job.system.includes("JSON Schema"), "agent claims the job (system carries the JSON schema)");
const bad1 = await completeJob(job.id, "sorry, here you go: not json");
ok(!bad1.ok && bad1.retry, "invalid answer is rejected and the job requeued");
const job2 = await claimJob("test-pc");
const plan = { posts: [{ slot: "evening", channels: "x", format: "claim_receipt", category: "meme", text: "the receipt for “trust me bro”", receipt: null, claim: { text: "trust me bro", stamp: "VOID" }, poll: null, why: "test" }] };
const good = await completeJob(job2.id, "```json\n" + JSON.stringify(plan) + "\n```");
ok(good.ok && good.outcome.queued === 1, "valid answer applied → 1 post queued");
const [eq] = await sql`select payload from chek.queue where id like 'eng-%'`;
ok(eq?.payload.imageUrl?.startsWith("/api/image?claim=trust+me+bro"), "claim receipt image URL built from the plan");
ok((await claimJob("test-pc", { noai: true })) === null, "agent without Claude access only checks in");

// dry-run report + live gate
const req = (url, init = {}) => new Request(`http://localhost${url}`, init);
const adm = (body) => admin.POST(req("/api/admin", { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify(body) }));
const rep = await (await adm({ op: "dry_report" })).json();
ok(rep.log.length >= 4 && rep.preview.length > 10 && rep.preview.some((p) => p.id === "x-310" && p.guard === "OK"), `dry report: ${rep.log?.length} log lines, ${rep.preview?.length} pre-checked upcoming posts (launch post OK with sample CA)`);
const live = await adm({ op: "settings", values: { autopilot: "on" } });
ok(live.status === 409, "autopilot=on refused before a finished dry run + passing production audit");
const cw = await adm({ op: "creator_wallet", address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" });
ok(cw.status === 200, "creator wallet can be announced privately");
await core.setSetting("schedule", { d1: "2026-10-02", launchAt: new Date(Date.now() + 3600e3).toISOString() });
const { launchWatch } = await import("../server/lib/launch.js");
ok((await launchWatch()).armed, "launch watcher is armed from T-2h");
const sched = await adm({ op: "schedule", launchAt: new Date(Date.now() + 5 * 3600e3).toISOString() });
ok(sched.status === 409, "a launch time < 26 h away is refused (announcement must be ≥ 24 h before)");
await core.setSetting("schedule", { d1: "2026-10-02", launchAt: null });

// vault
await vaultSet("t", { a: 1 });
ok((await vaultGet("t")).a === 1, "vault round-trip (AES-GCM)");
const [raw] = await sql`select value_enc from chek.vault where key = 't'`;
ok(!raw.value_enc.includes('"a"'), "vault stores ciphertext only");

// API auth + handlers
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
ok((await (await pub.GET(req("/api/public?op=token"))).json()).live === false, "public token endpoint: not live before launch");
const hit = await pub.POST(req("/api/public?op=hit", { method: "POST", body: JSON.stringify({ e: "gen" }) }));
const [{ v }] = await sql`select value::int as v from chek.metrics where key = 'rg_gen'`;
ok(hit.status === 200 && v === 1, "anonymous receipt-generator counter");

const [{ c: audits }] = await sql`select count(*)::int as c from chek.audit_log`;
ok(audits > 10, `audit log has ${audits} entries`);

console.log(failed ? `\n${failed} FAILED` : "\nall backend checks passed");
await sql.end({ timeout: 2 });
process.exit(failed ? 1 : 0);
