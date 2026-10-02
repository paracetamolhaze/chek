// Schema `chek`. Each migration runs once, in order, inside a transaction under an advisory lock.
// RLS is on with no policies: Supabase anon/authenticated roles get nothing; only the server role reads/writes.
export const MIGRATIONS = [
  {
    version: "001_foundation",
    sql: `
create table chek.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Every significant project action gets a receipt. verification says HOW it is known:
--   onchain  = read from Solana by our watcher (tx signature present)
--   reported = stated by the project, with a proof link (commit, post, invoice) — never shown as on-chain verified
create table chek.receipts (
  id bigserial primary key,
  number integer not null unique,
  kind text not null check (kind in ('build','feature','character','lore','payout','expense','fees','creator','milestone','community','launch','other')),
  title text not null check (char_length(title) between 1 and 120),
  status text not null check (status in ('SHIPPED','DELIVERED','PAID','RECEIVED','CLAIMED','BOUGHT','SOLD','MOVED','STARTED','KEPT','LOGGED')),
  verification text not null check (verification in ('onchain','reported')),
  amount numeric,
  currency text,
  tx text,
  proof_url text,
  proof_label text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  source text not null,
  dedupe_key text unique,
  data jsonb not null default '{}'::jsonb,
  check (verification <> 'onchain' or tx is not null)
);
create index receipts_occurred_idx on chek.receipts (occurred_at desc);

-- Content queue for every channel. level: auto (publish when due), review (owner approves), manual (never automatic).
create table chek.queue (
  id text primary key,
  platform text not null check (platform in ('x','telegram')),
  category text not null,
  level text not null default 'review' check (level in ('auto','review','manual')),
  status text not null default 'ready' check (status in ('ready','review','approved','rejected','publishing','published','failed','skipped','expired')),
  slot text,
  publish_after timestamptz,
  payload jsonb not null,
  requires jsonb not null default '[]'::jsonb,
  source jsonb,
  origin text not null default 'seed',
  receipt_id bigint references chek.receipts(id),
  attempts integer not null default 0,
  last_error text,
  external_id text,
  external_url text,
  published_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index queue_due_idx on chek.queue (status, publish_after);

-- Every automatic action, for debugging and because receipts.
create table chek.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  agent text not null,
  action text not null,
  result text not null check (result in ('ok','skip','error','info','dry')),
  ref text,
  source text,
  detail jsonb,
  error text
);
create index audit_at_idx on chek.audit_log (at desc);

create table chek.alerts (
  id bigserial primary key,
  at timestamptz not null default now(),
  level text not null check (level in ('info','warn','error')),
  kind text not null,
  message text not null,
  ref text,
  notified boolean not null default false,
  resolved_at timestamptz
);

create table chek.news_items (
  id bigserial primary key,
  url text not null unique,
  source text not null,
  title text not null,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  score real not null default 0,
  status text not null default 'new' check (status in ('new','candidate','rejected','drafted','review','used')),
  reason text,
  checked_at timestamptz,
  data jsonb not null default '{}'::jsonb
);
create index news_status_idx on chek.news_items (status, fetched_at desc);

create table chek.costs (
  id bigserial primary key,
  at timestamptz not null default now(),
  provider text not null check (provider in ('x_api','ai_api','rpc','hosting','database','images','other')),
  units numeric not null default 0,
  unit text not null,
  usd numeric not null default 0,
  ref text
);
create index costs_at_idx on chek.costs (at desc);

create table chek.metrics (
  day date not null,
  key text not null,
  value numeric not null default 0,
  primary key (day, key)
);

-- Encrypted credentials obtained via OAuth (e.g. X refresh token). AES-GCM with a key derived from APP_SECRET.
create table chek.vault (
  key text primary key,
  value_enc text not null,
  updated_at timestamptz not null default now()
);

alter table chek.settings enable row level security;
alter table chek.receipts enable row level security;
alter table chek.queue enable row level security;
alter table chek.audit_log enable row level security;
alter table chek.alerts enable row level security;
alter table chek.news_items enable row level security;
alter table chek.costs enable row level security;
alter table chek.metrics enable row level security;
alter table chek.vault enable row level security;
`,
  },
  {
    version: "002_dry_run_agents",
    sql: `
-- Dry run: a post the system WOULD have published is marked dry_published (consumed for that run) and logged in full.
alter table chek.queue drop constraint if exists queue_status_check;
alter table chek.queue add constraint queue_status_check
  check (status in ('ready','review','approved','rejected','publishing','published','failed','skipped','expired','dry_published'));
alter table chek.queue add column if not exists dry_at timestamptz;

-- Everything the publisher decided during a dry run: exact text, media, source, reasons.
create table chek.dry_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  run text not null,
  queue_id text not null,
  platform text not null,
  verdict text not null check (verdict in ('would_publish','rejected','review','approved','expired','waiting')),
  due_at timestamptz,
  slot text,
  level text,
  origin text,
  category text,
  parts jsonb,
  media text,
  source jsonb,
  reasons jsonb not null default '[]'::jsonb
);
create unique index dry_log_once on chek.dry_log (run, queue_id, verdict);
create index dry_log_run_idx on chek.dry_log (run, at);

-- AI work for the owner's PC agent (Claude through the owner's subscription; no API key in the cloud).
-- The cloud only queues prompts and validates answers; the PC agent claims a job, runs Claude, returns text.
create table chek.ai_jobs (
  id bigserial primary key,
  kind text not null,
  status text not null default 'queued' check (status in ('queued','running','done','failed','expired')),
  model text,
  system text not null,
  prompt text not null,
  meta jsonb not null default '{}'::jsonb,
  result text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null
);
create index ai_jobs_status_idx on chek.ai_jobs (status, created_at);

-- Mentions, replies and community submissions. Nothing here is answered automatically: candidates go to REVIEW.
create table chek.interactions (
  id text primary key,
  platform text not null check (platform in ('x','telegram')),
  kind text not null check (kind in ('mention','reply','quote','submission')),
  author text,
  author_id text,
  text text,
  url text,
  at timestamptz,
  status text not null default 'new' check (status in ('new','candidate','queued','ignored','handled')),
  consent text check (consent in ('credit','anonymous','no')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index interactions_status_idx on chek.interactions (status, created_at desc);

alter table chek.dry_log enable row level security;
alter table chek.ai_jobs enable row level security;
alter table chek.interactions enable row level security;
`,
  },
  {
    version: "003_drop_entries",
    sql: `
-- Receipt Drop entries: one public Solana address per Telegram account, from channel subscribers only.
create table chek.drop_entries (
  id bigserial primary key,
  tg_user_id bigint not null unique,
  wallet text not null unique check (char_length(wallet) between 32 and 44),
  created_at timestamptz not null default now(),
  winner boolean not null default false,
  sent_tx text
);
alter table chek.drop_entries enable row level security;
`,
  },
  {
    version: "004_x_drop",
    sql: `
-- X drop entries: a public reply to @chekcoinsol that contains a Solana address, checked from its public link.
-- One entry per X account and per address. drop_entries stays the separate Telegram drop list.
create table chek.x_drop_entries (
  id bigserial primary key,
  x_user_id text not null unique,
  x_handle text not null,
  wallet text not null unique check (char_length(wallet) between 32 and 44),
  reply_id text not null unique,
  parent_id text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  winner boolean not null default false,
  sent_tx text
);
-- rate limit for the public entry form: salted hashes only, never raw IPs; old rows are pruned
create table chek.rate_hits (key text not null, at timestamptz not null default now());
create index on chek.rate_hits (key, at);
alter table chek.x_drop_entries enable row level security;
alter table chek.rate_hits enable row level security;
`,
  },
];
