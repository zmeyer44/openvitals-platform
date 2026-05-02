import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { getImportDocumentBlob } from "../server/imports";

function contentDispositionFileName(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, "_");
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

        return new Response(new Uint8Array(document.bytes), {
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Disposition": `inline; filename="${contentDispositionFileName(document.fileName)}"`,
            "Content-Length": String(document.bytes.byteLength),
            "Content-Type": document.mimeType
          }
        });
      }
    }
  }
});
