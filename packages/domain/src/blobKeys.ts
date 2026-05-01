import { createHash } from "node:crypto";

export function sha256Hex(bytes: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildSourceDocumentObjectKey(input: {
  ownerUserId: string;
  sourceDocumentId: string;
  sha256: string;
  fileName: string;
}): string {
  const safeName = input.fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return `users/${input.ownerUserId}/source-documents/${input.sourceDocumentId}/${input.sha256}-${safeName || "document"}`;
}
