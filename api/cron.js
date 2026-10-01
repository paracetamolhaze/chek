// Called every few minutes by pg_cron (Supabase) and once a day by Vercel Cron as a backup.
import { handle, json, requireCron } from "../server/lib/http.js";
import { tick } from "../server/lib/jobs.js";

export const maxDuration = 300;

async function run(request) {
  return handle(async () => {
    requireCron(request);
    return json({ ok: true, at: new Date().toISOString(), result: await tick() });
  });
}

export const GET = run;
export const POST = run;
