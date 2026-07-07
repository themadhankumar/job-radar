import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const key = () => Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32-byte hex

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${enc.toString("hex")}`;
}

export function decrypt(stored: string): string {
  const [ivH, tagH, dataH] = stored.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivH, "hex"));
  decipher.setAuthTag(Buffer.from(tagH, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataH, "hex")), decipher.final()]).toString("utf8");
}
