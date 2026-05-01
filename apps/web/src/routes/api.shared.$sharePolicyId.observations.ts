import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import { listSharedObservationsForAuthenticatedRecipient } from "../server/shares";

export const Route = createFileRoute("/api/shared/$sharePolicyId/observations")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const recipient = await requireAuthenticatedOwnerContext(request);
        const observations = await listSharedObservationsForAuthenticatedRecipient(db, {
          recipient,
          sharePolicyId: params.sharePolicyId
        });
        return Response.json({ observations });
      }
    }
  }
});
