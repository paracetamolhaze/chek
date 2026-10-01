// X (Twitter) via the official API v2, OAuth 2.0 Authorization Code + PKCE (user context of the project account).
// The owner provides X_CLIENT_ID / X_CLIENT_SECRET (Vercel env) and opens "Connect X" once while logged in as the project account.
// Tokens are stored encrypted (vault); refresh tokens are single-use, so every refresh saves the new one.
// Facts as checked 2026-10-02: pay-per-use only; post $0.015, post with a URL $0.20, each media file billed as one post;
// max one cashtag per post; no unsolicited @mentions or quote posts on self-serve; automated accounts must carry the Automated label.
import { createHash, randomBytes } from "node:crypto";
import { audit, getSetting } from "./core.js";
import { env } from "./env.js";
import { sign } from "./http.js";
import { vaultGet, vaultSet } from "./vault.js";

const API = "https://api.x.com/2";
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"];
export const redirectUri = () => `${env.siteUrl}/api/x?op=callback`;

export function authorizeUrl() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  // state carries the verifier, signed with APP_SECRET (stateless; expires in 15 min)
  const payload = Buffer.from(JSON.stringify({ v: verifier, t: Date.now() })).toString("base64url");
  const state = `${payload}.${sign(payload)}`;
  const u = new URL("https://x.com/i/oauth2/authorize");
  u.search = new URLSearchParams({ response_type: "code", client_id: env.xClientId, redirect_uri: redirectUri(), scope: SCOPES.join(" "), state, code_challenge: challenge, code_challenge_method: "S256" });
  return u.toString();
}

function readState(state) {
  const [payload, mac] = String(state || "").split(".");
  if (!payload || sign(payload) !== mac) throw new Error("bad state");
  const s = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (Date.now() - s.t > 15 * 60e3) throw new Error("state expired");
  return s.v;
}

async function tokenRequest(params) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${Buffer.from(`${env.xClientId}:${env.xClientSecret}`).toString("base64")}` },
    body: new URLSearchParams({ ...params, client_id: env.xClientId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`x token: ${data.error_description || data.error || res.status}`);
  return { access: data.access_token, refresh: data.refresh_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000, scope: data.scope };
}

export async function handleCallback(code, state) {
  const verifier = readState(state);
  const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });
  const me = await (await fetch(`${API}/users/me`, { headers: { authorization: `Bearer ${tok.access}` } })).json();
  await vaultSet("x_oauth", { ...tok, user: me.data ?? null });
  await audit("publisher", "x.connected", "ok", { detail: { username: me.data?.username ?? null } });
  return me.data;
}

async function accessToken() {
  const t = await vaultGet("x_oauth");
  if (!t) throw new Error("X not connected");
  if (Date.now() < t.expiresAt) return t.access;
  const next = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh });
  await vaultSet("x_oauth", { ...t, ...next, refresh: next.refresh || t.refresh });
  return next.access;
}

export async function xReady() {
  if (!env.xClientId || !env.xClientSecret) return false;
  try {
    return Boolean(await vaultGet("x_oauth"));
  } catch {
    return false;
  }
}

export async function xAccount() {
  return (await vaultGet("x_oauth"))?.user ?? null;
}

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${await accessToken()}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = new Error(`x ${path}: ${res.status} ${data.detail || data.title || text.slice(0, 200)}`);
    e.status = res.status;
    e.reset = res.headers.get("x-rate-limit-reset");
    throw e;
  }
  return data;
}

// Media upload: images via simple upload; GIF/MP4 via initialize → append (4 MB chunks) → finalize → status.
async function uploadMedia(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`media fetch ${res.status}`);
  const type = (res.headers.get("content-type") || "").split(";")[0];
  const buf = Buffer.from(await res.arrayBuffer());
  if (/^image\/(png|jpeg|webp)$/.test(type)) {
    const form = new FormData();
    form.set("media", new Blob([buf], { type }), "media");
    form.set("media_category", "tweet_image");
    const data = await call("/media/upload", { method: "POST", body: form });
    return data.data?.id ?? null;
  }
  if (!/^(image\/gif|video\/mp4)$/.test(type)) return null;
  const init = await call("/media/upload/initialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ media_type: type, total_bytes: buf.length, media_category: type === "image/gif" ? "tweet_gif" : "tweet_video" }),
  });
  const id = init.data?.id;
  const CHUNK = 4 * 1024 * 1024;
  for (let i = 0, seg = 0; i < buf.length; i += CHUNK, seg++) {
    const form = new FormData();
    form.set("media", new Blob([buf.subarray(i, i + CHUNK)]), "chunk");
    form.set("segment_index", String(seg));
    await call(`/media/upload/${id}/append`, { method: "POST", body: form });
  }
  let info = (await call(`/media/upload/${id}/finalize`, { method: "POST" })).data?.processing_info;
  for (let n = 0; info && info.state !== "succeeded" && n < 20; n++) {
    if (info.state === "failed") throw new Error("media processing failed");
    await new Promise((r) => setTimeout(r, (info.check_after_secs ?? 2) * 1000));
    info = (await call(`/media/upload?command=STATUS&media_id=${id}`)).data?.processing_info;
  }
  return id;
}

const hasUrl = (t) => /https?:\/\/|\b[a-z0-9-]+\.(?:app|fun|io|xyz|com|org|net)\b/i.test(t);

// Post a single post or a thread (self-reply chain). Returns { id, url, calls, cost }.
export async function publishX({ parts, mediaUrl = null, poll = null }) {
  const prices = (await getSetting("prices")) || {};
  let calls = 0;
  let mediaId = null;
  if (mediaUrl && !poll) {
    try {
      mediaId = await uploadMedia(mediaUrl);
      calls++;
    } catch (e) {
      await audit("publisher", "x.media_failed", "error", { error: e.message, detail: { mediaUrl } });
    }
  }
  let first = null;
  let prev = null;
  for (const [i, text] of parts.entries()) {
    const body = { text };
    if (i === 0 && mediaId) body.media = { media_ids: [mediaId] };
    if (i === 0 && poll) body.poll = { options: poll.options.slice(0, 4).map((o) => o.slice(0, 25)), duration_minutes: poll.minutes ?? 1440 };
    if (prev) body.reply = { in_reply_to_tweet_id: prev };
    const data = await call("/tweets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    calls++;
    prev = data.data.id;
    first ||= prev;
  }
  const user = await xAccount();
  const cost = parts.reduce((s, t) => s + (hasUrl(t) ? (prices.xUrlPostUsd ?? 0.2) : (prices.xPostUsd ?? 0.015)), 0) + (mediaId ? (prices.xMediaUsd ?? 0.015) : 0);
  return { id: first, url: `https://x.com/${user?.username ?? "i"}/status/${first}`, calls, cost };
}

// Own mentions (owned read, cheapest tier). Used by the community agent (later phase).
export async function mentions(sinceId = null) {
  const user = await xAccount();
  if (!user) return null;
  const q = new URLSearchParams({ max_results: "50", "tweet.fields": "created_at,author_id,referenced_tweets", expansions: "author_id", "user.fields": "username" });
  if (sinceId) q.set("since_id", sinceId);
  return call(`/users/${user.id}/mentions?${q}`);
}
