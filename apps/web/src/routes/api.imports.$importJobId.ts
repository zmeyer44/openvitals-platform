import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { getImportDetail } from "../server/imports";

export const Route = createFileRoute("/api/imports/$importJobId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const detail = await getImportDetail(db, {
          owner,
          importJobId: params.importJobId
        });

        if (!detail) {
          return Response.json({ error: "Import not found." }, { status: 404 });
        }

        return Response.json(detail);
      }
    }
  }
});
