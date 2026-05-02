import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { getImportDocumentBlob } from "../server/imports";

const INLINE_SAFE_CONTENT_TYPES = new Map<string, string>([
  ["application/pdf", "application/pdf"],
  ["image/png", "image/png"],
  ["image/jpeg", "image/jpeg"],
  ["image/gif", "image/gif"],
  ["image/webp", "image/webp"],
  ["image/heic", "image/heic"],
  ["image/heif", "image/heif"]
]);

function contentDispositionFileName(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, "_");
}

function safeServingHeaders(rawMimeType: string): { contentType: string; disposition: "inline" | "attachment" } {
  const mimeType = (rawMimeType.split(";")[0] ?? "").trim().toLowerCase();
  const inlineType = INLINE_SAFE_CONTENT_TYPES.get(mimeType);
  if (inlineType) {
    return { contentType: inlineType, disposition: "inline" };
  }
  return { contentType: "application/octet-stream", disposition: "attachment" };
}

export const Route = createFileRoute("/api/imports/$importJobId/document")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const document = await getImportDocumentBlob(db, {
          owner,
          importJobId: params.importJobId
        });

        if (!document) {
          return Response.json({ error: "Import document not found." }, { status: 404 });
        }

        const { contentType, disposition } = safeServingHeaders(document.mimeType);

        return new Response(new Uint8Array(document.bytes), {
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Disposition": `${disposition}; filename="${contentDispositionFileName(document.fileName)}"`,
            "Content-Length": String(document.bytes.byteLength),
            "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'self'",
            "Content-Type": contentType,
            "X-Content-Type-Options": "nosniff"
          }
        });
      }
    }
  }
});
