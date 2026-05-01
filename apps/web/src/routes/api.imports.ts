import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { createImport } from "../server/imports";

const createImportRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  idempotencyKey: z.string().min(1).max(255).optional()
});

export const Route = createFileRoute("/api/imports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const body = createImportRequestSchema.parse(await request.json());
        const result = await createImport(db, {
          owner,
          fileName: body.fileName,
          mimeType: body.mimeType,
          contentBase64: body.contentBase64,
          idempotencyKey: body.idempotencyKey
        });

        return Response.json(result);
      }
    }
  }
});
