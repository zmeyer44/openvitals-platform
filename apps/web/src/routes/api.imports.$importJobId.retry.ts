import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { ImportApiError, retryImport } from "../server/imports";

export const Route = createFileRoute("/api/imports/$importJobId/retry")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);

        try {
          const detail = await retryImport(db, {
            owner,
            importJobId: params.importJobId
          });

          if (!detail) {
            return Response.json({ error: "Import not found." }, { status: 404 });
          }

          return Response.json(detail);
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
