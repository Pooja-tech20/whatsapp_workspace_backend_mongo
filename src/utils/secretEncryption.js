
import crypto from "node:crypto";
import { env } from "../config/env.js";

function getKey() {
  // Use a strong, private JWT_ACCESS_SECRET from your .env.
  return crypto
    .createHash("sha256")
    .update(env.JWT_ACCESS_SECRET)
    .digest();
}

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final()
  ]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex")
  ].join(":");
}

export function decryptSecret(value) {
  if (!value) return "";

  const [ivHex, tagHex, encryptedHex] = value.split(":");

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid encrypted secret");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("utf8");
}

export function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "********";

  return `${value.slice(0, 4)}${"*".repeat(8)}${value.slice(-4)}`;
}
