import { createFileRoute } from "@tanstack/react-router";
import { requireAuthenticatedOwnerContext } from "../server/auth-context";
import { db } from "../server/db";
import {
  createSharePolicy,
  createSharePolicyBodySchema,
  listSharePoliciesForOwner,
  ShareApiError
} from "../server/shares";

export const Route = createFileRoute("/api/shares")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const policies = await listSharePoliciesForOwner(db, { owner });
        return Response.json({ sharePolicies: policies });
      },

      POST: async ({ request }) => {
        const owner = await requireAuthenticatedOwnerContext(request);
        const body = await request.json();
        const parsed = createSharePolicyBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              error: "Invalid share policy.",
              code: "invalid_share_policy",
              issues: parsed.error.issues
            },
            { status: 400 }
          );
        }

        try {
          const result = await createSharePolicy(db, { owner, body: parsed.data });
          return Response.json(result, { status: 201 });
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
