import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const algorithm = "aes-256-gcm";

function decodeKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("OPENVITALS_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  }
  return key;
}

export function encryptSecret(plaintext: string, base64Key: string): string {
  const key = decodeKey(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(ciphertext: string, base64Key: string): string {
  const [version, ivText, tagText, bodyText] = ciphertext.split(".");
  if (version !== "v1" || !ivText || !tagText || !bodyText) {
    throw new Error("Unsupported encrypted secret format");
  }

  const key = decodeKey(base64Key);
  const decipher = createDecipheriv(algorithm, key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(bodyText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function preserveRefreshToken(input: {
  previousEncryptedRefreshToken: string | null;
  incomingRefreshToken?: string | null;
  base64Key: string;
}): string | null {
  if (input.incomingRefreshToken) {
    return encryptSecret(input.incomingRefreshToken, input.base64Key);
  }

  return input.previousEncryptedRefreshToken;
}

export function verifyHmacSignature(input: {
  payload: string | Buffer;
  secret: string;
  signatureHeader: string | null;
  timestampHeader?: string | null;
  toleranceSeconds?: number;
  prefix?: string;
}): boolean {
  if (!input.signatureHeader) {
    return false;
  }

  if (input.timestampHeader) {
    const timestampMs = Number(input.timestampHeader) * 1000;
    const toleranceMs = (input.toleranceSeconds ?? 300) * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > toleranceMs) {
      return false;
    }
  }

  const signedPayload = input.timestampHeader
    ? `${input.timestampHeader}.${input.payload.toString()}`
    : input.payload.toString();

  const expected = createHmac("sha256", input.secret).update(signedPayload).digest("hex");
  const received = input.signatureHeader.replace(input.prefix ?? "sha256=", "").trim();

  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(received, "hex");

  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, receivedBytes);
}
