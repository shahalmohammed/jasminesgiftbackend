// src/services/r2.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { env } from "../config/env"; // if you don't have this, remove and use process.env only

// Prefer env wrapper if available, otherwise fall back to process.env
const R2_ACCOUNT_ID = (env as any)?.R2_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = (env as any)?.R2_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY =
  (env as any)?.R2_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = (env as any)?.R2_BUCKET ?? process.env.R2_BUCKET;
const R2_PUBLIC_BASE = (env as any)?.R2_PUBLIC_BASE ?? process.env.R2_PUBLIC_BASE;

// Validate env eagerly so errors are obvious in logs
const requiredEnv: Array<[string, string | undefined]> = [
  ["R2_ACCOUNT_ID", R2_ACCOUNT_ID],
  ["R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID],
  ["R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY],
  ["R2_BUCKET", R2_BUCKET],
];

for (const [name, value] of requiredEnv) {
  if (!value) {
    console.error(`R2 config error: ${name} is not set`);
    throw new Error(`R2 configuration error: ${name} is not set`);
  }
}

const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID as string,
    secretAccessKey: R2_SECRET_ACCESS_KEY as string,
  },
});

function buildPublicUrl(key: string) {
  const base = (R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (base) return `${base}/${key}`;

  // Fallback to bucket subdomain form:
  return `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

export async function uploadToR2(opts: {
  buffer: Buffer;
  mime: string;
  prefix?: string; // e.g. "products/"
  ext?: string; // e.g. ".png"
}) {
  const key = `${opts.prefix ?? ""}${randomUUID()}${opts.ext ?? ""}`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.mime,
      })
    );
    return { key, url: buildPublicUrl(key) };
  } catch (err) {
    console.error("uploadToR2 error:", err);
    throw err;
  }
}

export async function deleteFromR2(key: string) {
  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );
  } catch (err) {
    console.error("deleteFromR2 error:", err);
    throw err;
  }
}
