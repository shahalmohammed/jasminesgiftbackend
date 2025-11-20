// src/services/r2.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env"; // make sure env exposes R2_* vars
import { randomUUID } from "crypto";

const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

function buildPublicUrl(key: string) {
  const base = (process.env.R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (base) return `${base}/${key}`;

  // Fallback to bucket subdomain form:
  return `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

export async function uploadToR2(opts: {
  buffer: Buffer;
  mime: string;
  prefix?: string;   // e.g. "products/"
  ext?: string;      // e.g. ".png"
}) {
  const key = `${opts.prefix ?? ""}${randomUUID()}${opts.ext ?? ""}`;
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: opts.buffer,
    ContentType: opts.mime,
    // Do NOT set ACL here; R2 manages public access at bucket/domain level
  }));
  return { key, url: buildPublicUrl(key) };
}

export async function deleteFromR2(key: string) {
  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  }));
}
