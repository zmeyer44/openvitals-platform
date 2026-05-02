import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { revokeSharePolicy, ShareApiError } from "../server/shares";

export const Route = createFileRoute("/api/shares/$sharePolicyId/revoke")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        try {
          const policy = await revokeSharePolicy(db, {
            owner,
            sharePolicyId: params.sharePolicyId
          });
          return Response.json({ policy });
        } catch (error) {
          if (error instanceof ShareApiError) {
            return Response.json({ error: error.message, code: error.code }, { status: error.status });
          }
          throw error;
        }
      }
    }
  }
});
