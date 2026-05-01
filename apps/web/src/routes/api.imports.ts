import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { importJobStates } from "@openvitals/domain";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { createImport, ImportApiError, listImports, parseMultipartImportRequest } from "../server/imports";

const listImportsSearchSchema = z.object({
  status: z.enum(importJobStates).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const Route = createFileRoute("/api/imports")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const query = listImportsSearchSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
        const imports = await listImports(db, {
          owner,
          status: query.status,
          limit: query.limit
        });

        return Response.json({ imports });
      },

      POST: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        try {
          const upload = await parseMultipartImportRequest(request);
          const result = await createImport(db, {
            owner,
            fileName: upload.fileName,
            mimeType: upload.mimeType,
            content: upload.content,
            idempotencyKey: upload.idempotencyKey
          });

          return Response.json(result, { status: 201 });
        } catch (error) {
          if (error instanceof ImportApiError) {
            return Response.json({ error: error.message, code: error.code }, { status: error.status });
          }

          throw error;
        }
      }
    }
  }
});
