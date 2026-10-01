// Encrypted storage for credentials obtained at runtime (e.g. the X refresh token). AES-256-GCM, key derived from APP_SECRET.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "./db.js";
import { env } from "./env.js";

const key = () => {
  if (!env.appSecret) throw new Error("APP_SECRET missing");
  return createHash("sha256").update(`chek-vault:${env.appSecret}`).digest();
};

export async function vaultSet(name, value) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  const blob = [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
  const sql = await db();
  await sql`insert into chek.vault (key, value_enc) values (${name}, ${blob}) on conflict (key) do update set value_enc = excluded.value_enc, updated_at = now()`;
}

export async function vaultGet(name) {
  const sql = await db();
  const [row] = await sql`select value_enc from chek.vault where key = ${name}`;
  if (!row) return null;
  const [iv, tag, enc] = row.value_enc.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8"));
}

export async function vaultDelete(name) {
  const sql = await db();
  await sql`delete from chek.vault where key = ${name}`;
}
