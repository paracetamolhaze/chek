import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function cached(data, seconds = 60) {
  return json(data, 200, { "cache-control": `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}` });
}

export function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const bearer = (request) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

export function requireCron(request) {
  if (!env.cronSecret || !safeEqual(bearer(request) || request.headers.get("x-cron-secret"), env.cronSecret)) throw new AppError(401, "unauthorized");
}

export function requireAdmin(request) {
  if (!env.adminToken || !safeEqual(bearer(request), env.adminToken)) throw new AppError(401, "unauthorized");
}

export function sign(value) {
  return createHmac("sha256", env.appSecret || "unset").update(value).digest("base64url");
}

export async function handle(fn) {
  try {
    return await fn();
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    if (status >= 500) console.error(e);
    return json({ error: status >= 500 ? "internal error" : e.message }, status);
  }
}

export async function readJson(request, limit = 64_000) {
  const text = await request.text();
  if (text.length > limit) throw new AppError(413, "too large");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AppError(400, "bad json");
  }
}
