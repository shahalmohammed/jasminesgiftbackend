"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2 = void 0;
exports.uploadToR2 = uploadToR2;
exports.deleteFromR2 = deleteFromR2;
// src/services/r2.ts
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
exports.r2 = new client_s3_1.S3Client({
    region: "auto",
    endpoint,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
function buildPublicUrl(key) {
    const base = (process.env.R2_PUBLIC_BASE || "").replace(/\/+$/, "");
    if (base)
        return `${base}/${key}`;
    // Fallback to bucket subdomain form:
    return `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}
async function uploadToR2(opts) {
    const key = `${opts.prefix ?? ""}${(0, crypto_1.randomUUID)()}${opts.ext ?? ""}`;
    await exports.r2.send(new client_s3_1.PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.mime,
        // Do NOT set ACL here; R2 manages public access at bucket/domain level
    }));
    return { key, url: buildPublicUrl(key) };
}
async function deleteFromR2(key) {
    await exports.r2.send(new client_s3_1.DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
    }));
}
