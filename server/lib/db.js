// Postgres (Supabase via Vercel Storage), schema `chek`. Pattern proven on the owner's other projects:
// - parse the URL ourselves (Supabase adds pooler params postgres.js would send as session settings);
// - prepare: false (transaction pooler);
// - a Gate keeps in-flight queries ≤ connections, otherwise postgres.js pipelines into a busy
//   connection and Supavisor hands the second half to another backend → the query hangs until timeout.
import postgres from "postgres";
import { env } from "./env.js";
import { AppError } from "./http.js";
import { MIGRATIONS } from "./migrations.js";

const MIGRATION_LOCK = 734_100_042;
const MAX_CONNECTIONS = 6;

let client = null;
let ready = null;

function connectionOptions(url) {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: sslmode === "disable" || (local && sslmode !== "require") ? false : "require",
    prepare: false,
    fetch_types: false,
    max: MAX_CONNECTIONS,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 10,
    onnotice: () => {},
    connection: { application_name: "chek" },
  };
}

class Gate {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.waiting = [];
  }
  acquire() {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiting.push(resolve));
  }
  release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

function gatedQuery(query, gate) {
  let running = null;
  const run = () => (running ||= gate.run(() => query));
  const wrapper = {
    then: (ok, err) => run().then(ok, err),
    catch: (err) => run().catch(err),
    finally: (f) => run().finally(f),
    simple() {
      query.simple();
      return wrapper;
    },
  };
  return wrapper;
}

function gated(raw) {
  const gate = new Gate(MAX_CONNECTIONS);
  const sql = (first, ...rest) => (Array.isArray(first) && Array.isArray(first.raw) ? gatedQuery(raw(first, ...rest), gate) : raw(first, ...rest));
  sql.begin = (...args) => gate.run(() => raw.begin(...args));
  sql.unsafe = (...args) => gatedQuery(raw.unsafe(...args), gate);
  sql.json = (...args) => raw.json(...args);
  sql.array = (...args) => raw.array(...args);
  sql.end = (...args) => raw.end(...args);
  return sql;
}

async function txLimits(tx, ms = 15_000) {
  await tx`select set_config('lock_timeout', '10s', true),
    set_config('idle_in_transaction_session_timeout', '20s', true),
    set_config('statement_timeout', ${`${ms}ms`}, true)`;
}

export function sqlClient() {
  const url = env.databaseUrl;
  if (!url) throw new AppError(503, "database not connected");
  client ||= gated(postgres(connectionOptions(url)));
  return client;
}

export async function migrate(sql) {
  const applied = [];
  await sql.begin(async (tx) => {
    await txLimits(tx, 60_000);
    await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK})`;
    await tx`create schema if not exists chek`.simple();
    await tx`create table if not exists chek.schema_migrations (version text primary key, applied_at timestamptz not null default now())`.simple();
    const done = new Set((await tx`select version from chek.schema_migrations`).map((r) => r.version));
    for (const m of MIGRATIONS) {
      if (done.has(m.version)) continue;
      await tx.unsafe(m.sql).simple();
      await tx`insert into chek.schema_migrations (version) values (${m.version})`;
      applied.push(m.version);
    }
  });
  return applied;
}

export async function db() {
  const sql = sqlClient();
  ready ||= migrate(sql).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return sql;
}

export { txLimits };
