import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { listCanonicalRecordsForOwner, listCanonicalRecordsQuerySchema } from "../server/records";

export const Route = createFileRoute("/api/records")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const parsed = listCanonicalRecordsQuerySchema.safeParse(
          Object.fromEntries(new URL(request.url).searchParams)
        );

        if (!parsed.success) {
          return Response.json(
            {
              error: "Invalid records query.",
              code: "invalid_records_query",
              issues: parsed.error.issues
            },
            { status: 400 }
          );
        }

        const result = await listCanonicalRecordsForOwner(db, { owner, query: parsed.data });
        return Response.json({
          resourceType: parsed.data.resourceType,
          bucket: parsed.data.bucket ?? null,
          counts: result.counts,
          records: result.records
        });
      }
    }
  }
});
