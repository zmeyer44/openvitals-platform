import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import {
  applyActionToCanonicalRecord,
  canonicalResourceTypeSchema,
  recordActionBodySchema,
  ReviewApiError
} from "../server/reviews";

export const Route = createFileRoute("/api/records/$resourceType/$resourceId/action")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);

        const resourceTypeParse = canonicalResourceTypeSchema.safeParse(params.resourceType);
        if (!resourceTypeParse.success) {
          return Response.json(
            { error: "Unknown canonical resource type.", code: "invalid_resource_type" },
            { status: 400 }
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body.", code: "invalid_json" }, { status: 400 });
        }

        const parsed = recordActionBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid record action.", code: "invalid_record_action", issues: parsed.error.issues },
            { status: 400 }
          );
        }

        try {
          const result = await applyActionToCanonicalRecord(db, {
            owner,
            resourceType: resourceTypeParse.data,
            resourceId: params.resourceId,
            body: parsed.data
          });
          return Response.json(result);
        } catch (error) {
          if (error instanceof ReviewApiError) {
            return Response.json({ error: error.message, code: error.code }, { status: error.status });
          }
          throw error;
        }
      }
    }
  }
});
