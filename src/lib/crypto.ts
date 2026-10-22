import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface Ciphertext {
  iv: string;
  tag: string;
  body: string;
  version: 1;
}

export function seal(plaintext: string, key: Buffer, binding: string): Ciphertext {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(binding));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    body: body.toString("base64url"),
    version: 1,
  };
}

export function open(envelope: Ciphertext, key: Buffer, binding: string): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
